'use client'

import {
  applyPatchOperations,
  migrationOperationsSchema,
  type Schema,
  schemaSchema,
} from '@liam-hq/schema'
import { err, ok, ResultAsync } from 'neverthrow'
import * as v from 'valibot'
import { createClient } from '../../../../../libs/db/client'
import type { Version } from '../../../types'

function getPreviousVersions(
  buildingSchemaId: string,
  latestVersionNumber: number,
) {
  const supabase = createClient()

  return ResultAsync.fromSafePromise(
    supabase
      .from('building_schema_versions')
      .select('number, patch')
      .eq('building_schema_id', buildingSchemaId)
      .lte('number', latestVersionNumber)
      .order('number', { ascending: true }),
  ).andThen(({ data, error }) => {
    if (error) {
      // Surface the failure instead of silently treating it as "no previous
      // versions" - swallowing it here caused the ERD to silently collapse to
      // an empty schema on any transient query failure (see buildCurrentSchema).
      return err(
        new Error(`Failed to load previous versions: ${error.message}`),
      )
    }

    return ok(data)
  })
}

export function buildCurrentSchema(
  targetVersion: Version,
): ResultAsync<Schema, Error> {
  const supabase = createClient()

  return ResultAsync.fromSafePromise(
    supabase
      .from('building_schemas')
      .select('id, initial_schema_snapshot')
      .eq('id', targetVersion.building_schema_id)
      .single(),
  )
    .andThen(({ data: buildingSchema, error: buildingSchemaError }) => {
      if (buildingSchemaError) {
        // Same reasoning as above: don't silently fall through to an empty
        // schema on a query failure - throw so the caller keeps showing the
        // last good schema instead of blanking the ERD.
        return err(
          new Error(
            `Failed to load building schema: ${buildingSchemaError.message}`,
          ),
        )
      }

      return ok(buildingSchema)
    })
    .andThen((buildingSchema) =>
      getPreviousVersions(buildingSchema.id, targetVersion.number).map(
        (previousVersions) => ({ buildingSchema, previousVersions }),
      ),
    )
    .map(({ buildingSchema, previousVersions }) => {
      const operationsArray = previousVersions
        .map((version) => {
          const parsed = v.safeParse(migrationOperationsSchema, version.patch)
          if (!parsed.success) return null

          return parsed.output
        })
        .filter((version) => version !== null)

      const parsedInitialSchema = v.safeParse(
        schemaSchema,
        buildingSchema.initial_schema_snapshot,
      )

      const baseSchema: Schema = parsedInitialSchema.success
        ? parsedInitialSchema.output
        : {
            tables: {},
            enums: {},
            extensions: {},
          }

      let currentSchema: Schema = structuredClone(baseSchema)
      for (const operations of operationsArray) {
        const result = applyPatchOperations(currentSchema, operations)
        if (result.isErr()) {
          console.warn('Failed to apply patch operations:', result.error)
          break
        }
        currentSchema = result.value
      }

      return currentSchema
    })
}
