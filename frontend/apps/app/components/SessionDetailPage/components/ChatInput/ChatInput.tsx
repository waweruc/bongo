'use client'

import type { ChangeEvent, FC, FormEvent } from 'react'
import { useRef, useState } from 'react'
import { useAutoResizeTextarea } from '../../../../features/sessions/components/shared/hooks/useAutoResizeTextarea'
import { useEnterKeySubmission } from '../../../../features/sessions/components/shared/hooks/useEnterKeySubmission'
import { SessionFormActions } from '../../../../features/sessions/components/shared/SessionFormActions'
import styles from './ChatInput.module.css'

type Props = {
  isStreaming: boolean
  onSend: (text: string) => void
  onCancel: () => void
}

export const ChatInput: FC<Props> = ({ isStreaming, onSend, onCancel }) => {
  const [textContent, setTextContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const hasContent = textContent.trim().length > 0

  const handleEnterKeySubmission = useEnterKeySubmission(
    hasContent,
    isStreaming,
    formRef,
  )

  const { handleChange, adjustHeight } = useAutoResizeTextarea(textareaRef)
  const handleTextareaChange = handleChange(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setTextContent(e.target.value)
    },
  )

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = textContent.trim()
    if (!trimmed || isStreaming) return

    onSend(trimmed)
    setTextContent('')
    requestAnimationFrame(adjustHeight)
  }

  return (
    <div className={styles.container}>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className={styles.inputSection}>
          <textarea
            ref={textareaRef}
            placeholder="Ask Bongo ERD to make changes..."
            value={textContent}
            onChange={handleTextareaChange}
            onKeyDown={handleEnterKeySubmission}
            className={styles.textarea}
            disabled={isStreaming}
            rows={1}
          />
          <div className={styles.buttonContainer}>
            <SessionFormActions
              isPending={isStreaming}
              hasContent={hasContent}
              onCancel={onCancel}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
