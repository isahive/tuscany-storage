"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import ReplyIcon from "@mui/icons-material/Reply";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { formatDate } from "@/lib/utils";

type ContactStatus = "new" | "read" | "replied";

interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: string;
}

interface RecipientRow {
  id: string;
  email: string;
  active: boolean;
}

const STATUS_COLORS: Record<ContactStatus, { bg: string; color: string }> = {
  new: { bg: "#DBEAFE", color: "#1E3A5F" },
  read: { bg: "#F3F4F6", color: "#374151" },
  replied: { bg: "#D1FAE5", color: "#065F46" },
};

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
};

type StatusFilter = ContactStatus | "all";

// ─── MessageDialog ────────────────────────────────────────────────────────────

function MessageDialog({
  row,
  onClose,
  onReply,
}: {
  row: ContactRow | null;
  onClose: () => void;
  onReply: (row: ContactRow) => void;
}) {
  if (!row) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 600,
        }}
      >
        Message from {row.name}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
            From
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {row.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {row.email}
          </Typography>
          {row.phone && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {row.phone}
            </Typography>
          )}
        </Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
            Received
          </Typography>
          <Typography variant="body2">{formatDate(row.createdAt)}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
            Message
          </Typography>
          <Typography
            variant="body1"
            sx={{
              whiteSpace: "pre-wrap",
              bgcolor: "#FAF7F2",
              p: 2,
              borderRadius: 1,
            }}
          >
            {row.message}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} size="small">
          Close
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<ReplyIcon fontSize="small" />}
          onClick={() => {
            onClose();
            onReply(row);
          }}
          sx={{
            bgcolor: "#1C0F06",
            color: "#fff",
            "&:hover": {
              bgcolor: "#2C1F16",
            },
            textTransform: "none",
          }}
        >
          Reply
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── ReplyDialog ──────────────────────────────────────────────────────────────

function ReplyDialog({
  row,
  message,
  onChange,
  sending,
  onSend,
  onMarkReplied,
  onClose,
}: {
  row: ContactRow | null;
  message: string;
  onChange: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  onMarkReplied: () => void;
  onClose: () => void;
}) {
  if (!row) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 600,
        }}
      >
        Reply to {row.name}
        <IconButton size="small" onClick={onClose} disabled={sending}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            To
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {row.email}
          </Typography>
        </Box>
        <Box sx={{ mb: 2, bgcolor: "#FAF7F2", p: 1.5, borderRadius: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Original message
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
            {row.message}
          </Typography>
        </Box>
        <TextField
          label="Your reply"
          multiline
          rows={6}
          fullWidth
          value={message}
          onChange={(e) => onChange(e.target.value)}
          size="small"
          disabled={sending}
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, justifyContent: "space-between" }}>
        <Button
          size="small"
          sx={{
            color: "text.secondary",
            textTransform: "none",
            fontSize: "0.75rem",
          }}
          onClick={onMarkReplied}
          disabled={sending}
        >
          Mark as replied (no email)
        </Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={sending} size="small">
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={onSend}
            disabled={sending || !message.trim()}
            sx={{
              bgcolor: "#1C0F06",
              color: "#fff",
              "&:hover": {
                bgcolor: "#2C1F16",
              },
              textTransform: "none",
            }}
          >
            {sending ? "Sending…" : "Send Reply"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

// ─── NotificationSettings ─────────────────────────────────────────────────────

function NotificationSettings({
  recipients,
  newEmail,
  addingEmail,
  onEmailChange,
  onAdd,
  onToggle,
  onRemove,
}: {
  recipients: RecipientRow[];
  newEmail: string;
  addingEmail: boolean;
  onEmailChange: (v: string) => void;
  onAdd: () => void;
  onToggle: (id: string, active: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card sx={{ mt: 3, border: "1px solid #EDE5D8", boxShadow: "none" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <NotificationsIcon fontSize="small" sx={{ color: "#1C0F06" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Notification Recipients
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          The admin email always receives a notification when a new contact form
          submission arrives. Add extra recipients below to also notify other
          addresses. Hit Reply in your email client to respond directly to the
          submitter.
        </Typography>

        {recipients.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            No custom recipients — only the admin email will be notified.
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {recipients.map((r) => (
              <Box
                key={r.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  py: 0.75,
                  borderBottom: "1px solid #F3F0EC",
                  "&:last-child": { borderBottom: "none" },
                }}
              >
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                  {r.email}
                </Typography>
                <Switch
                  size="small"
                  checked={r.active}
                  onChange={(e) => onToggle(r.id, e.target.checked)}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: r.active ? "#065F46" : "text.disabled",
                    minWidth: 48,
                  }}
                >
                  {r.active ? "Active" : "Off"}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => onRemove(r.id)}
                  sx={{
                    color: "text.disabled",
                    "&:hover": { color: "error.main" },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            placeholder="email@example.com"
            size="small"
            type="email"
            value={newEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
            }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={onAdd}
            disabled={addingEmail || !newEmail.trim()}
            startIcon={<AddIcon />}
            sx={{
              bgcolor: "#1C0F06",
              color: "#fff",
              "&:hover": { bgcolor: "#2C1F16" },
              textTransform: "none",
              whiteSpace: "nowrap",
            }}
          >
            Add
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SiteFormsPage() {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedRow, setSelectedRow] = useState<ContactRow | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Notification recipients
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [addingEmail, setAddingEmail] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Reply dialog
  const [replyRow, setReplyRow] = useState<ContactRow | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [subRes, recRes] = await Promise.all([
          fetch("/api/admin/site-forms"),
          fetch("/api/admin/site-forms/notification-recipients"),
        ]);
        const subJson = await subRes.json();
        const recJson = await recRes.json();
        if (subJson.success) setRows(subJson.data);
        if (recJson.success) setRecipients(recJson.data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const counts = rows.reduce<Record<ContactStatus, number>>(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { new: 0, read: 0, replied: 0 },
  );

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.message.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function showSnackbar(
    message: string,
    severity: "success" | "error" = "success",
  ) {
    setSnackbar({ open: true, message, severity });
  }

  async function updateStatus(id: string, status: ContactStatus) {
    try {
      const res = await fetch("/api/admin/site-forms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      showSnackbar(`Marked as ${STATUS_LABELS[status]}.`);
    } catch {
      showSnackbar("Failed to update status.", "error");
    }
  }

  function openReply(row: ContactRow) {
    setReplyRow(row);
    setReplyMessage("");
  }

  async function sendReply() {
    if (!replyRow || !replyMessage.trim()) return;
    setReplySending(true);
    try {
      const res = await fetch("/api/admin/site-forms/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: replyRow.id, message: replyMessage }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows((prev) =>
        prev.map((r) =>
          r.id === replyRow.id ? { ...r, status: "replied" } : r,
        ),
      );
      showSnackbar("Reply sent.");
      setReplyRow(null);
    } catch {
      showSnackbar("Failed to send reply.", "error");
    } finally {
      setReplySending(false);
    }
  }

  // Notification recipients management
  async function addRecipient() {
    if (!newEmail.trim()) return;
    setAddingEmail(true);
    try {
      const res = await fetch("/api/admin/site-forms/notification-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRecipients((prev) => [...prev, json.data]);
      setNewEmail("");
      showSnackbar("Recipient added.");
    } catch (err: any) {
      showSnackbar(
        err.message === "Email already exists"
          ? "That email is already in the list."
          : "Failed to add recipient.",
        "error",
      );
    } finally {
      setAddingEmail(false);
    }
  }

  async function toggleRecipient(id: string, active: boolean) {
    try {
      const res = await fetch("/api/admin/site-forms/notification-recipients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRecipients((prev) =>
        prev.map((r) => (r.id === id ? { ...r, active } : r)),
      );
    } catch {
      showSnackbar("Failed to update recipient.", "error");
    }
  }

  async function removeRecipient(id: string) {
    try {
      const res = await fetch("/api/admin/site-forms/notification-recipients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRecipients((prev) => prev.filter((r) => r.id !== id));
      showSnackbar("Recipient removed.");
    } catch {
      showSnackbar("Failed to remove recipient.", "error");
    }
  }

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: "email",
      headerName: "Email",
      flex: 1.2,
      minWidth: 170,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: "phone",
      headerName: "Phone",
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {(params.value as string) || "—"}
        </Typography>
      ),
    },
    {
      field: "message",
      headerName: "Message",
      flex: 2,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: "createdAt",
      headerName: "Date",
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {params.value ? formatDate(params.value as string) : "—"}
        </Typography>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      renderCell: (params: GridRenderCellParams) => {
        const s = params.value as ContactStatus;
        return (
          <Chip
            label={STATUS_LABELS[s]}
            size="small"
            sx={{
              bgcolor: STATUS_COLORS[s].bg,
              color: STATUS_COLORS[s].color,
              fontWeight: 600,
              fontSize: "0.7rem",
              borderRadius: 1,
            }}
          />
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as ContactRow;
        return (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            <Tooltip title="View full message">
              <IconButton
                size="small"
                onClick={() => {
                  setSelectedRow(row);
                  if (row.status === "new") updateStatus(row.id, "read");
                }}
                sx={{
                  color: "#1E3A5F",
                  "&:hover": { bgcolor: "rgba(30,58,95,0.08)" },
                }}
              >
                <MarkEmailReadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send reply">
              <IconButton
                size="small"
                onClick={() => openReply(row)}
                sx={{
                  color: "#065F46",
                  "&:hover": { bgcolor: "rgba(6,95,70,0.08)" },
                }}
              >
                <ReplyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 16 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Site Forms
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {rows.length} total submission{rows.length !== 1 ? "s" : ""}
          </Typography>
          <Button
            size="small"
            startIcon={<NotificationsIcon fontSize="small" />}
            onClick={() => setSettingsOpen((v) => !v)}
            sx={{
              textTransform: "none",
              color: settingsOpen ? "#1C0F06" : "text.secondary",
              borderColor: settingsOpen ? "#1C0F06" : undefined,
              fontSize: "0.75rem",
            }}
            variant={settingsOpen ? "outlined" : "text"}
          >
            Notification Settings
          </Button>
        </Box>
      </Box>

      {/* Summary chips */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
        {(["new", "read", "replied"] as ContactStatus[]).map((s) => (
          <Chip
            key={s}
            label={`${STATUS_LABELS[s]}: ${counts[s]}`}
            size="small"
            sx={{
              bgcolor: STATUS_COLORS[s].bg,
              color: STATUS_COLORS[s].color,
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
        ))}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2, border: "1px solid #EDE5D8", boxShadow: "none" }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField
              placeholder="Search by name, email, or message..."
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 240 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="read">Read</MenuItem>
                <MenuItem value="replied">Replied</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card sx={{ border: "1px solid #EDE5D8", boxShadow: "none" }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          rowHeight={56}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          sx={{
            border: "none",
            bgcolor: "#FFFFFF",
            "& .MuiDataGrid-columnHeader": {
              bgcolor: "#1C0F06",
              color: "#FFFFFF",
              fontWeight: 600,
            },
            "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
            "& .MuiDataGrid-sortIcon": { color: "rgba(255,255,255,0.7)" },
            "& .MuiDataGrid-menuIconButton": { color: "rgba(255,255,255,0.7)" },
            "& .MuiDataGrid-row:hover": { bgcolor: "#FAF7F2" },
            "& .MuiDataGrid-cell": {
              borderColor: "#EDE5D8",
              display: "flex",
              alignItems: "center",
            },
            "& .MuiDataGrid-footerContainer": { borderColor: "#EDE5D8" },
            "& .MuiDataGrid-columnSeparator": {
              color: "rgba(255,255,255,0.2)",
            },
          }}
        />
      </Card>

      {/* Notification settings (toggled) */}
      {settingsOpen && (
        <NotificationSettings
          recipients={recipients}
          newEmail={newEmail}
          addingEmail={addingEmail}
          onEmailChange={setNewEmail}
          onAdd={addRecipient}
          onToggle={toggleRecipient}
          onRemove={removeRecipient}
        />
      )}

      {/* Message dialog */}
      {selectedRow && (
        <MessageDialog
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onReply={openReply}
        />
      )}

      {/* Reply dialog */}
      <ReplyDialog
        row={replyRow}
        message={replyMessage}
        onChange={setReplyMessage}
        sending={replySending}
        onSend={sendReply}
        onMarkReplied={() => {
          if (replyRow) updateStatus(replyRow.id, "replied");
          setReplyRow(null);
        }}
        onClose={() => setReplyRow(null)}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
