'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import LinkIcon from '@mui/icons-material/Link'
import ImageIcon from '@mui/icons-material/Image'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { useSetAdminPageTitle } from '@/lib/admin-page-title'

// ── Placeholder definitions ───────────────────────────────────────────────────

interface PlaceholderGroup { category: string; tokens: { token: string; label: string }[] }

const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    category: 'Customer',
    tokens: [
      { token: 'CUSTOMER_NAME',     label: 'Customer Name' },
      { token: 'CUSTOMER_USERNAME', label: 'Customer Username' },
      { token: 'CUSTOMER_EMAIL',    label: 'Customer Email' },
      { token: 'CUSTOMER_PHONE',    label: 'Customer Phone' },
    ],
  },
  {
    category: 'Unit',
    tokens: [
      { token: 'UNIT_NUMBER',  label: 'Unit Number' },
      { token: 'UNIT_SIZE',    label: 'Unit Size' },
      { token: 'MONTHLY_RATE', label: 'Monthly Rate' },
      { token: 'GATE_CODE',    label: 'Gate Code' },
    ],
  },
  {
    category: 'Account',
    tokens: [
      { token: 'BALANCE',  label: 'Balance' },
      { token: 'DUE_DATE', label: 'Due Date' },
      { token: 'DATE',     label: 'Today\u2019s Date' },
    ],
  },
  {
    category: 'Facility',
    tokens: [
      { token: 'FACILITY_NAME',    label: 'Facility Name' },
      { token: 'FACILITY_PHONE',   label: 'Facility Phone' },
      { token: 'FACILITY_EMAIL',   label: 'Facility Email' },
      { token: 'FACILITY_ADDRESS', label: 'Facility Address' },
      { token: 'FACILITY_URL',     label: 'Facility URL' },
    ],
  },
]

// ── Insert Placeholder dropdown button ────────────────────────────────────────

function InsertPlaceholderButton({ onInsert }: { onInsert: (token: string) => void }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  return (
    <>
      <Button
        size="small"
        endIcon={<KeyboardArrowDownIcon fontSize="small" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          textTransform: 'none',
          color: '#3B82F6',
          fontSize: '0.8rem',
          fontWeight: 500,
          px: 1,
          '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' },
        }}
      >
        Insert Placeholder
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { maxHeight: 380 } } }}
      >
        {PLACEHOLDER_GROUPS.map((group, gi) => [
          <Typography
            key={`${group.category}-h`}
            variant="caption"
            sx={{ display: 'block', px: 2, pt: gi === 0 ? 1 : 1.5, pb: 0.5, color: '#D97757', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            {group.category}
          </Typography>,
          ...group.tokens.map((p) => (
            <MenuItem
              key={p.token}
              onClick={() => { onInsert(p.token); setAnchorEl(null) }}
              sx={{ fontSize: '0.875rem', py: 0.5 }}
            >
              {p.label}
              <Typography component="span" sx={{ ml: 'auto', pl: 2, fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                {`[[${p.token}]]`}
              </Typography>
            </MenuItem>
          )),
        ])}
      </Menu>
    </>
  )
}

// ── Toolbar pieces ────────────────────────────────────────────────────────────

function TBtn({ active, onClick, disabled, children }: {
  active?: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <IconButton
      size="small"
      onClick={onClick}
      disabled={disabled}
      sx={{
        borderRadius: 1,
        p: 0.5,
        color: active ? '#3B82F6' : 'text.secondary',
        bgcolor: active ? 'rgba(59,130,246,0.1)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
      }}
    >
      {children}
    </IconButton>
  )
}

function TDivider() {
  return <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: '#E5E1D8' }} />
}

// ── Email/Letter rich-text editor ─────────────────────────────────────────────

function EmailLetterEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
    ],
    content: value || '<p></p>',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Sync external value changes back into the editor (e.g. when template loads
  // after the editor instance has already initialised).
  useEffect(() => {
    if (!editor) return
    if (value && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  const insert = (token: string) => editor?.chain().focus().insertContent(`[[${token}]]`).run()
  const insertImage = () => {
    const url = prompt('Image URL')
    if (url) editor?.chain().focus().insertContent(`<img src="${url}" alt="" />`).run()
  }
  const insertLink = () => {
    const url = prompt('Link URL')
    if (url) editor?.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run()
  }

  return (
    <Box sx={{ border: '1px solid #E5E1D8', borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, px: 1, py: 0.5, bgcolor: '#FAF8F4', borderBottom: '1px solid #E5E1D8' }}>
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
          sx={{ height: 28, fontSize: '0.8rem', mr: 0.5, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E1D8' } }}
        >
          <MenuItem value="p" sx={{ fontSize: '0.8rem' }}>Paragraph</MenuItem>
          <MenuItem value="h1" sx={{ fontSize: '0.8rem' }}>Heading 1</MenuItem>
          <MenuItem value="h2" sx={{ fontSize: '0.8rem' }}>Heading 2</MenuItem>
          <MenuItem value="h3" sx={{ fontSize: '0.8rem' }}>Heading 3</MenuItem>
        </Select>
        <Select
          size="small"
          value="12pt"
          onChange={() => { /* fixed display — TipTap StarterKit lacks per-text font-size */ }}
          sx={{ height: 28, fontSize: '0.8rem', mr: 0.5, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E1D8' } }}
        >
          <MenuItem value="12pt" sx={{ fontSize: '0.8rem' }}>12pt</MenuItem>
        </Select>
        <TDivider />
        <TBtn active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <FormatBoldIcon fontSize="small" />
        </TBtn>
        <TBtn active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <FormatItalicIcon fontSize="small" />
        </TBtn>
        <TBtn active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <FormatUnderlinedIcon fontSize="small" />
        </TBtn>
        <TBtn onClick={insertLink}>
          <LinkIcon fontSize="small" />
        </TBtn>
        <TDivider />
        <TBtn active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
          <FormatAlignLeftIcon fontSize="small" />
        </TBtn>
        <TBtn active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
          <FormatAlignCenterIcon fontSize="small" />
        </TBtn>
        <TBtn active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
          <FormatAlignRightIcon fontSize="small" />
        </TBtn>
        <TDivider />
        <TBtn active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <FormatListBulletedIcon fontSize="small" />
        </TBtn>
        <TBtn active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <FormatListNumberedIcon fontSize="small" />
        </TBtn>
        <TDivider />
        <InsertPlaceholderButton onInsert={insert} />
        <TBtn onClick={insertImage}>
          <ImageIcon fontSize="small" />
        </TBtn>
      </Box>
      <Box
        sx={{
          minHeight: 320,
          p: 2,
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          '& .ProseMirror': { outline: 'none', minHeight: 300 },
          '& .ProseMirror p': { mb: 1.5 },
          '& .ProseMirror h1, & .ProseMirror h2, & .ProseMirror h3': { fontWeight: 700, my: 1.5 },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  )
}

// ── Plain-text + Insert Placeholder textarea ──────────────────────────────────

function TextMessageEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  function insert(token: string) {
    const tag = `[[${token}]]`
    const el = ref.current
    if (!el) { onChange(value + tag); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + tag + value.slice(end)
    onChange(next)
    // restore caret right after the inserted token
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + tag.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
        <InsertPlaceholderButton onInsert={insert} />
      </Box>
      <TextField
        fullWidth
        multiline
        minRows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputRef={ref}
      />
    </Box>
  )
}

// ── Section container ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid #E5E1D8', borderRadius: 1, mb: 3, overflow: 'hidden' }}>
      <Box sx={{ bgcolor: '#F1EEE8', px: 3, py: 1.75, borderBottom: '1px solid #E5E1D8' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1C0F06' }}>{title}</Typography>
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface TemplateForm {
  name: string
  type: 'default' | 'custom'
  description: string
  emailSubject: string
  emailContent: string
  textContent: string
  postcardContent: string
  emailEnabled: boolean
  textEnabled: boolean
  printEnabled: boolean
  rule: string
  daysPastDue: number | ''
}

const EMPTY_FORM: TemplateForm = {
  name: '',
  type: 'custom',
  description: '',
  emailSubject: '',
  emailContent: '',
  textContent: '',
  postcardContent: '',
  emailEnabled: true,
  textEnabled: false,
  printEnabled: false,
  rule: 'manual',
  daysPastDue: '',
}

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const isNew = id === 'new'

  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)

  const pageTitle = useMemo(
    () => isNew ? 'Create Template' : (form.name ? `Edit ${form.name} Template` : 'Edit Template'),
    [isNew, form.name],
  )
  useSetAdminPageTitle(pageTitle)

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/templates/${id}`)
        if (!res.ok) throw new Error('Template not found')
        const json = await res.json()
        if (!json.success) throw new Error(json.error ?? 'Template not found')
        if (cancelled) return
        const t = json.data ?? {}
        setForm({
          name: t.name || '',
          type: t.type || 'custom',
          description: t.description || '',
          emailSubject: t.emailSubject || '',
          emailContent: t.emailContent || t.emailBody || '',  // back-compat with old field name
          textContent: t.textContent || t.textBody || '',
          postcardContent: t.postcardContent || '',
          emailEnabled: t.emailEnabled ?? t.channels?.email ?? true,
          textEnabled:  t.textEnabled  ?? t.channels?.text  ?? false,
          printEnabled: t.printEnabled ?? t.channels?.print ?? false,
          rule: t.rule || 'manual',
          daysPastDue: t.daysPastDue ?? '',
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load template')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, isNew])

  function set<K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setError(null); setSaving(true)
    try {
      if (!form.name.trim()) {
        throw new Error('Title is required')
      }
      const url = isNew ? '/api/admin/templates' : `/api/admin/templates/${id}`
      const method = isNew ? 'POST' : 'PUT'
      const body = {
        name: form.name.trim(),
        description: form.description,
        emailSubject: form.emailSubject,
        emailContent: form.emailContent,
        textContent: form.textContent,
        postcardContent: form.postcardContent,
        emailEnabled: form.emailEnabled,
        textEnabled: form.textEnabled,
        printEnabled: form.printEnabled,
        rule: form.rule,
        daysPastDue: form.daysPastDue === '' ? null : Number(form.daysPastDue),
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save')
      setSavedOpen(true)
      if (isNew && json.data?._id) {
        router.replace(`/admin/communications/templates/${json.data._id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const headerTitle = isNew ? 'Create Template' : `Edit ${form.name || 'Template'}${form.name ? ' Template' : ''}`

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header — breadcrumb is rendered by the admin layout's app bar. */}
      <Typography variant="h4" sx={{ color: '#D97757', fontWeight: 700, mb: 1 }}>
        {headerTitle}
      </Typography>

      {form.description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, mt: 2 }}>
          {form.description}
        </Typography>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Template Details */}
      <Section title="Template Details">
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Title</Typography>
        <TextField
          fullWidth
          size="small"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          disabled={!isNew && form.type === 'default'}
          sx={{ mb: 2 }}
        />

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Description</Typography>
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </Section>

      {/* Email Options */}
      <Section title="Email Options">
        <FormControlLabel
          control={
            <Checkbox
              checked={form.emailEnabled}
              onChange={(e) => set('emailEnabled', e.target.checked)}
              sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }}
            />
          }
          label="Automatic Email Enabled"
          sx={{ mb: 2, '& .MuiTypography-root': { fontWeight: 600 } }}
        />

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Email Subject</Typography>
        <TextField
          fullWidth size="small"
          value={form.emailSubject}
          onChange={(e) => set('emailSubject', e.target.value)}
          sx={{ mb: 2 }}
        />

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Email/Letter Content</Typography>
        <EmailLetterEditor
          value={form.emailContent}
          onChange={(html) => set('emailContent', html)}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          The email won&apos;t be sent if left blank.
        </Typography>
      </Section>

      {/* Text Message Options */}
      <Section title="Text Message Options">
        <FormControlLabel
          control={
            <Checkbox
              checked={form.textEnabled}
              onChange={(e) => set('textEnabled', e.target.checked)}
              sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }}
            />
          }
          label="Automatic Text Enabled"
          sx={{ mb: 2, '& .MuiTypography-root': { fontWeight: 600 } }}
        />

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Text Message Content</Typography>
        <TextMessageEditor
          value={form.textContent}
          onChange={(v) => set('textContent', v)}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          The text won&apos;t be sent if left blank.
        </Typography>
      </Section>

      {/* Postcard Options */}
      <Section title="Postcard Options">
        <FormControlLabel
          control={
            <Checkbox
              checked={form.printEnabled}
              onChange={(e) => set('printEnabled', e.target.checked)}
              sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }}
            />
          }
          label="Automatic Print Enabled"
          sx={{ mb: 2, '& .MuiTypography-root': { fontWeight: 600 } }}
        />

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Postcard Content</Typography>
        <EmailLetterEditor
          value={form.postcardContent}
          onChange={(html) => set('postcardContent', html)}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          The content will be truncated to fit on a standard postcard.
        </Typography>
      </Section>

      {/* Footer */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 4 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          disableElevation
          sx={{ bgcolor: '#3B82F6', textTransform: 'none', px: 3, '&:hover': { bgcolor: '#2563EB' } }}
        >
          {saving ? 'Saving…' : (isNew ? 'Create Template' : 'Update Template')}
        </Button>
        <MuiLink
          component="button"
          type="button"
          onClick={() => router.push('/admin/communications/templates')}
          sx={{ color: '#3B82F6' }}
        >
          Cancel
        </MuiLink>
      </Box>

      <Snackbar
        open={savedOpen}
        autoHideDuration={3000}
        onClose={() => setSavedOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSavedOpen(false)}>Template saved</Alert>
      </Snackbar>
    </Box>
  )
}
