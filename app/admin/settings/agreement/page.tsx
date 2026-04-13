'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import ImageIcon from '@mui/icons-material/Image'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Typography_ from '@tiptap/extension-typography'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import './EditorStyles.css'

// ── Placeholder token definitions ─────────────────────────────────────────────

interface PlaceholderDef { token: string; label: string }
interface PlaceholderGroup { category: string; items: PlaceholderDef[] }

const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    category: 'Tenant',
    items: [
      { token: 'CUSTOMER_NAME', label: 'Name' },
      { token: 'CUSTOMER_ADDRESS', label: 'Address' },
      { token: 'CUSTOMER_PHONE_NUMBER', label: 'Phone' },
      { token: 'EMAIL_ADDRESS', label: 'Email' },
      { token: 'CUSTOMER_USERNAME', label: 'Username' },
    ],
  },
  {
    category: 'Unit',
    items: [
      { token: 'UNIT', label: 'Unit #' },
      { token: 'UNIT_SIZE', label: 'Size' },
      { token: 'RENT', label: 'Rent' },
      { token: 'DEPOSIT', label: 'Deposit' },
      { token: 'CUSTOMER_ACCESS_CODE', label: 'Access Code' },
    ],
  },
  {
    category: 'Agreement',
    items: [
      { token: 'DATE', label: 'Date' },
      { token: 'BALANCE', label: 'Balance' },
      { token: 'FACILITY_NAME', label: 'Facility Name' },
    ],
  },
  {
    category: 'Alternate',
    items: [
      { token: 'ALTERNATE_CONTACT', label: 'Alt. Name' },
      { token: 'ALTERNATE_ADDRESS', label: 'Alt. Address' },
      { token: 'ALTERNATE_PHONE_NUMBER', label: 'Alt. Phone' },
      { token: 'ALTERNATE_EMAIL', label: 'Alt. Email' },
    ],
  },
]

// ── Default content (TipTap JSON) ─────────────────────────────────────────────

const DEFAULT_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1, textAlign: 'center' },
      content: [{ type: 'text', text: 'Storage Rental Agreement' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Occupant: ' },
        { type: 'text', text: '[[CUSTOMER_NAME]], [[CUSTOMER_ADDRESS]], [[CUSTOMER_PHONE_NUMBER]], [[EMAIL_ADDRESS]]' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Username: ' },
        { type: 'text', text: '[[CUSTOMER_USERNAME]]' },
        { type: 'text', text: '     Gate Access Code: ' },
        { type: 'text', marks: [{ type: 'bold' }], text: '[[CUSTOMER_ACCESS_CODE]]#' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Unit: ' },
        { type: 'text', text: '[[UNIT]]  ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Size: ' },
        { type: 'text', text: '[[UNIT_SIZE]]  ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Monthly Price: ' },
        { type: 'text', text: '[[RENT]]  ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Deposit Paid: ' },
        { type: 'text', text: '[[DEPOSIT]]' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Rental Agreement Date: ' },
        { type: 'text', text: '[[DATE]]' },
      ],
    },
    { type: 'horizontalRule' },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Alternate Contact' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Name: ' },
        { type: 'text', text: '[[ALTERNATE_CONTACT]]' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Address: ' },
        { type: 'text', text: '[[ALTERNATE_ADDRESS]]' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Phone: ' },
        { type: 'text', text: '[[ALTERNATE_PHONE_NUMBER]]   ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Email: ' },
        { type: 'text', text: '[[ALTERNATE_EMAIL]]' },
      ],
    },
    { type: 'horizontalRule' },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Late Fees' }],
    },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '$20 if Delinquent after 5 Days' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'NSF Fee: $35' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Auction/Sale Fee: $50' }] }] },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Total Amount Currently Due: ' },
        { type: 'text', text: '[[BALANCE]]' },
      ],
    },
    { type: 'horizontalRule' },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '[Agreement body goes here — paste the full legal text]' }],
    },
    { type: 'horizontalRule' },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'OWNER/MANAGER: _______________________________     OCCUPANT: [[CUSTOMER_NAME]]' },
      ],
    },
  ],
}

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function TBtn({
  title,
  active,
  onClick,
  children,
  disabled,
}: {
  title: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Tooltip title={title} arrow placement="top">
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            borderRadius: 1,
            p: 0.5,
            color: active ? '#B8914A' : 'text.secondary',
            bgcolor: active ? 'rgba(184,145,74,0.1)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(184,145,74,0.15)', color: '#B8914A' },
            '&.Mui-disabled': { opacity: 0.35 },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

function TDivider() {
  return <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#EDE5D8' }} />
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgreementTemplatePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedJson, setSavedJson] = useState<string>('')

  // ── Editor ────────────────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Highlight,
      Typography_,
      Placeholder.configure({ placeholder: 'Start typing your agreement…' }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: DEFAULT_CONTENT,
    immediatelyRender: false,
  })

  // ── Load settings ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings')
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load')
        const stored: string = json.data?.agreementTemplate ?? ''
        if (stored && editor) {
          try {
            const parsed = JSON.parse(stored)
            editor.commands.setContent(parsed)
          } catch {
            // legacy plain text — wrap in a paragraph
            editor.commands.setContent(`<p>${stored.replace(/\n/g, '</p><p>')}</p>`)
          }
          setSavedJson(stored)
        } else {
          setSavedJson(JSON.stringify(DEFAULT_CONTENT))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings')
        setSavedJson(JSON.stringify(DEFAULT_CONTENT))
      } finally {
        setLoading(false)
      }
    }
    if (editor) load()
  }, [editor])

  // ── Insert placeholder ────────────────────────────────────────────────────

  const insertPlaceholder = useCallback(
    (token: string) => {
      if (!editor) return
      editor.chain().focus().insertContent(`[[${token}]]`).run()
    },
    [editor],
  )

  // ── Image upload ──────────────────────────────────────────────────────────

  const [uploading, setUploading] = useState(false)

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Upload failed')
        editor.chain().focus().setImage({ src: json.url }).run()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Image upload failed')
      } finally {
        setUploading(false)
      }
    },
    [editor],
  )

  // ── Dirty check ───────────────────────────────────────────────────────────

  const [currentJson, setCurrentJson] = useState('')
  useEffect(() => {
    if (!editor) return
    const handler = () => setCurrentJson(JSON.stringify(editor.getJSON()))
    editor.on('update', handler)
    return () => { editor.off('update', handler) }
  }, [editor])

  const isDirty = currentJson !== '' && currentJson !== savedJson

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    setError(null)
    try {
      const jsonStr = JSON.stringify(editor.getJSON())
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementTemplate: jsonStr }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to save')
      setSavedJson(jsonStr)
      setCurrentJson(jsonStr)
      setSavedOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agreement')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: '#B8914A' }} />
      </Box>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          component={Link}
          href="/admin/settings"
          startIcon={<ArrowBackIcon />}
          sx={{
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': { color: '#B8914A', bgcolor: 'transparent' },
            px: 0,
            minWidth: 0,
          }}
        >
          Setup
        </Button>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, color: '#1C0F06', flex: 1 }}
        >
          Storage Agreement
        </Typography>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isDirty}
          sx={{
            bgcolor: '#B8914A',
            '&:hover': { bgcolor: '#9A7A3E' },
            '&.Mui-disabled': { bgcolor: '#D4B87A', color: 'white' },
            textTransform: 'none',
            fontWeight: 600,
            px: 2.5,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Editor shell */}
      <Box
        sx={{
          border: '1px solid #EDE5D8',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'white',
        }}
      >
        {/* ── Sticky toolbar ──────────────────────────────────────────────── */}
        <Box
          sx={{
            position: 'sticky',
            top: 64,
            zIndex: 10,
            bgcolor: '#FAF7F2',
            borderBottom: '1px solid #EDE5D8',
          }}
        >
          {/* Formatting row */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, px: 1.5, py: 1 }}>
            {/* Heading select */}
            <Select
              size="small"
              value={
                editor?.isActive('heading', { level: 1 }) ? 'h1'
                : editor?.isActive('heading', { level: 2 }) ? 'h2'
                : editor?.isActive('heading', { level: 3 }) ? 'h3'
                : 'p'
              }
              onChange={(e) => {
                if (!editor) return
                const val = e.target.value
                if (val === 'p') editor.chain().focus().setParagraph().run()
                else {
                  const level = parseInt(val.replace('h', '')) as 1 | 2 | 3
                  editor.chain().focus().toggleHeading({ level }).run()
                }
              }}
              sx={{
                height: 30,
                fontSize: '0.8rem',
                mr: 0.5,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#EDE5D8' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#B8914A' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#B8914A' },
              }}
            >
              <MenuItem value="p" sx={{ fontSize: '0.8rem' }}>Paragraph</MenuItem>
              <MenuItem value="h1" sx={{ fontSize: '0.8rem', fontWeight: 700 }}>Heading 1</MenuItem>
              <MenuItem value="h2" sx={{ fontSize: '0.8rem', fontWeight: 700 }}>Heading 2</MenuItem>
              <MenuItem value="h3" sx={{ fontSize: '0.8rem', fontWeight: 700 }}>Heading 3</MenuItem>
            </Select>

            <TDivider />

            <TBtn title="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
              <FormatBoldIcon fontSize="small" />
            </TBtn>
            <TBtn title="Italic" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <FormatItalicIcon fontSize="small" />
            </TBtn>
            <TBtn title="Underline" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
              <FormatUnderlinedIcon fontSize="small" />
            </TBtn>
            <TBtn title="Strikethrough" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
              <FormatStrikethroughIcon fontSize="small" />
            </TBtn>

            <TDivider />

            <TBtn title="Align left" active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
              <FormatAlignLeftIcon fontSize="small" />
            </TBtn>
            <TBtn title="Align center" active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
              <FormatAlignCenterIcon fontSize="small" />
            </TBtn>
            <TBtn title="Align right" active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
              <FormatAlignRightIcon fontSize="small" />
            </TBtn>

            <TDivider />

            <TBtn title="Bullet list" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <FormatListBulletedIcon fontSize="small" />
            </TBtn>
            <TBtn title="Numbered list" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <FormatListNumberedIcon fontSize="small" />
            </TBtn>

            <TDivider />

            <TBtn title="Horizontal rule" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
              <HorizontalRuleIcon fontSize="small" />
            </TBtn>
            <TBtn
              title="Insert image"
              disabled={uploading}
              onClick={() => document.getElementById('agreement-img-input')?.click()}
            >
              {uploading
                ? <CircularProgress size={16} sx={{ color: '#B8914A' }} />
                : <ImageIcon fontSize="small" />}
            </TBtn>

            <TDivider />

            <TBtn title="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
              <UndoIcon fontSize="small" />
            </TBtn>
            <TBtn title="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
              <RedoIcon fontSize="small" />
            </TBtn>
          </Box>

          {/* Hidden image file input */}
          <input
            id="agreement-img-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
              e.target.value = ''
            }}
          />

          {/* Placeholder chips row */}
          <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              Insert:
            </Typography>
            {PLACEHOLDER_GROUPS.map((group) => (
              <Box key={group.category} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                <Typography
                  variant="caption"
                  sx={{ color: '#B8914A', fontWeight: 600, letterSpacing: '0.04em', mr: 0.25 }}
                >
                  {group.category}
                </Typography>
                {group.items.map(({ token, label }) => (
                  <Chip
                    key={token}
                    label={label}
                    size="small"
                    onClick={() => insertPlaceholder(token)}
                    title={`[[${token}]]`}
                    sx={{
                      fontFamily: '"DM Sans", sans-serif',
                      fontSize: '0.7rem',
                      height: 22,
                      bgcolor: 'white',
                      border: '1px solid #EDE5D8',
                      color: '#1C0F06',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#B8914A', color: 'white', borderColor: '#B8914A' },
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                ))}
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Document canvas ─────────────────────────────────────────────── */}
        <div className="agreement-editor-scroll-wrapper">
          <div className="agreement-editor-canvas">
            <EditorContent editor={editor} />
          </div>
        </div>
      </Box>

      {/* Success snackbar */}
      <Snackbar
        open={savedOpen}
        autoHideDuration={3000}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSavedOpen(false)}
          severity="success"
          variant="filled"
          sx={{ bgcolor: '#B8914A', color: 'white', fontWeight: 500, '& .MuiAlert-icon': { color: 'white' } }}
        >
          Agreement saved successfully
        </Alert>
      </Snackbar>
    </Box>
  )
}
