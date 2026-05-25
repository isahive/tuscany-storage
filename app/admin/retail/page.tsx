'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Grid,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import InventoryIcon from '@mui/icons-material/Inventory'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

// ── Types ───────────────────────────────────────────────────────────────────

interface Product {
  _id: string
  name: string
  price: number
  cost: number
  taxRate: number
  description: string
  inventory: number
  active: boolean
}

// ── Product Dialog ──────────────────────────────────────────────────────────

function ProductDialog({ open, onClose, product, onSaved }: {
  open: boolean; onClose: () => void; product: Product | null; onSaved: () => void
}) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name: '', price: '', cost: '', taxRate: '', description: '', inventory: '-1',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        price: (product.price / 100).toFixed(2),
        cost: (product.cost / 100).toFixed(2),
        taxRate: product.taxRate.toString(),
        description: product.description,
        inventory: product.inventory.toString(),
      })
    } else {
      setForm({ name: '', price: '', cost: '', taxRate: '', description: '', inventory: '-1' })
    }
    setError(null)
  }, [product, open])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const priceVal = Math.round(parseFloat(form.price || '0') * 100)
      const costVal = Math.round(parseFloat(form.cost || '0') * 100)
      const taxRateVal = parseFloat(form.taxRate || '0')
      const inventoryVal = parseInt(form.inventory || '-1', 10)

      if (!form.name.trim()) throw new Error('Name is required')
      if (isNaN(priceVal) || priceVal < 0) throw new Error('Invalid price')

      const payload = {
        ...(isEdit ? { id: product._id } : {}),
        name: form.name.trim(),
        price: priceVal,
        cost: costVal,
        taxRate: taxRateVal,
        description: form.description.trim(),
        inventory: inventoryVal,
      }

      const res = await fetch('/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to save')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{isEdit ? 'Edit Product' : 'Add Product'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <TextField label="Product Name" fullWidth size="small" value={form.name} onChange={set('name')} required />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Price" fullWidth size="small" value={form.price} onChange={set('price')}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Cost" fullWidth size="small" value={form.cost} onChange={set('cost')}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              helperText="Wholesale cost (optional)"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Tax Rate" fullWidth size="small" value={form.taxRate} onChange={set('taxRate')}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Inventory" fullWidth size="small" value={form.inventory} onChange={set('inventory')}
              helperText="-1 = unlimited"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Description" fullWidth size="small" multiline rows={2} value={form.description} onChange={set('description')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} disableElevation>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Product'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Inventory Dialog ────────────────────────────────────────────────────────

function InventoryDialog({ open, onClose, product, onSaved }: {
  open: boolean; onClose: () => void; product: Product | null; onSaved: () => void
}) {
  // Storable parity — admin picks an action type, types a quantity (signed
  // when "Adjustment"), and writes a reason. Both surface on the audit log.
  const [action, setAction] = useState<'received' | 'adjustment'>('received')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAction('received')
      setQuantity('')
      setReason('')
      setError(null)
    }
  }, [open])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const qty = parseInt(quantity, 10)
      if (Number.isNaN(qty)) throw new Error('Please enter a quantity.')
      const res = await fetch(`/api/admin/products/${product?._id}/adjust-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, quantity: qty, reason }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Could not save')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Change Inventory — {product?.name}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Current stock: <strong>{product?.inventory === -1 ? 'Unlimited' : product?.inventory}</strong>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant={action === 'received' ? 'contained' : 'outlined'}
            onClick={() => setAction('received')}
            disableElevation
            sx={{ textTransform: 'none' }}
          >
            Received (+)
          </Button>
          <Button
            size="small"
            variant={action === 'adjustment' ? 'contained' : 'outlined'}
            onClick={() => setAction('adjustment')}
            disableElevation
            sx={{ textTransform: 'none' }}
          >
            Adjustment (±)
          </Button>
        </Box>
        <TextField
          label={action === 'received' ? 'Quantity received' : 'Adjustment (e.g. -3)'}
          fullWidth size="small" type="number"
          value={quantity} onChange={(e) => setQuantity(e.target.value)}
          helperText={action === 'received'
            ? 'Positive whole number only.'
            : 'Use a negative number to remove stock, positive to add.'}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Reason / note"
          fullWidth size="small" multiline minRows={2}
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Optional — e.g. count correction, damaged unit, supplier shipment"
        />
        {error && <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} disableElevation>
          {saving ? 'Saving...' : 'Save Change'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Delete Confirm Dialog ───────────────────────────────────────────────────

function DeleteDialog({ open, onClose, product, onDeleted }: {
  open: boolean; onClose: () => void; product: Product | null; onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/products?id=${product?._id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error)
      onDeleted()
      onClose()
    } finally { setDeleting(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Delete Product</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Are you sure you want to delete <strong>{product?.name}</strong>? This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting} disableElevation>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function RetailSalesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [walkInOpen, setWalkInOpen] = useState(false)

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      const json = await res.json()
      if (json.success) setProducts(json.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: '#2C3826', fontFamily: 'var(--font-outfit), system-ui, sans-serif', mb: 1 }}
      >
        Retail Sale
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Products can be sold while renting a unit to a tenant or added separately later.
      </Typography>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, pb: 0, gap: 1 }}>
            <Button variant="outlined" disableElevation size="small"
              onClick={() => setWalkInOpen(true)}>
              Walk-In Sale
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} disableElevation size="small"
              onClick={() => { setEditProduct(null); setAddOpen(true) }}>
              Add Product
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : products.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No products yet. Add your first product to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{
                    '& th': {
                      bgcolor: '#2C3826', color: 'white', fontWeight: 600, fontSize: '0.8rem',
                    },
                  }}>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Cost</TableCell>
                    <TableCell align="right">Tax Rate</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="center">Inventory</TableCell>
                    <TableCell align="right" sx={{ minWidth: 180 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p._id} sx={{
                      '&:hover': { bgcolor: '#FAF7F2' },
                      '& td': { borderColor: '#E5E7EB' },
                    }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{fmt(p.price)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {p.cost > 0 ? fmt(p.cost) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {p.taxRate > 0 ? `${p.taxRate}%` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.description || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {p.inventory === -1 ? (
                          <Chip label="Unlimited" size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600, fontSize: '0.7rem' }} />
                        ) : (
                          <Chip
                            label={p.inventory}
                            size="small"
                            sx={{
                              bgcolor: p.inventory <= 0 ? '#FEE2E2' : p.inventory <= 5 ? '#FEF3C7' : '#D1FAE5',
                              color: p.inventory <= 0 ? '#991B1B' : p.inventory <= 5 ? '#92400E' : '#065F46',
                              fontWeight: 600, fontSize: '0.7rem', minWidth: 32,
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Change inventory">
                            <Button size="small" variant="text" sx={{ fontSize: '0.75rem', textTransform: 'none', color: 'primary.main' }}
                              onClick={() => setInventoryProduct(p)}
                              startIcon={<InventoryIcon sx={{ fontSize: 16 }} />}>
                              inventory
                            </Button>
                          </Tooltip>
                          <Tooltip title="Edit product">
                            <IconButton size="small" onClick={() => { setEditProduct(p); setAddOpen(true) }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete product">
                            <IconButton size="small" sx={{ color: '#DC2626' }} onClick={() => setDeleteProduct(p)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <ProductDialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditProduct(null) }}
        product={editProduct}
        onSaved={loadProducts}
      />

      {/* Inventory Dialog */}
      <InventoryDialog
        open={!!inventoryProduct}
        onClose={() => setInventoryProduct(null)}
        product={inventoryProduct}
        onSaved={loadProducts}
      />

      {/* Delete Dialog */}
      <DeleteDialog
        open={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        product={deleteProduct}
        onDeleted={loadProducts}
      />

      {/* Walk-In Sale Dialog */}
      <WalkInSaleDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        products={products}
        onSold={loadProducts}
      />
    </Box>
  )
}

// ── Walk-In Sale Dialog ─────────────────────────────────────────────────────

function WalkInSaleDialog({ open, onClose, products, onSold }: {
  open: boolean
  onClose: () => void
  products: Product[]
  onSold: () => void
}) {
  const [items, setItems] = useState<Array<{ productId: string; quantity: number }>>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'check' | 'other'>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setItems([])
      setPaymentMethod('cash')
      setNote('')
      setError(null)
    }
  }, [open])

  const active = products.filter((p) => p.active)
  const total = items.reduce((sum, it) => {
    const p = products.find((x) => x._id === it.productId)
    if (!p) return sum
    const sub = p.price * it.quantity
    const tax = Math.round(sub * (p.taxRate / 100))
    return sum + sub + tax
  }, 0)

  function addItem() {
    if (active.length === 0) return
    setItems((rs) => [...rs, { productId: active[0]._id, quantity: 1 }])
  }

  async function handleSell() {
    setSaving(true); setError(null)
    try {
      if (items.length === 0) throw new Error('Add at least one item.')
      const res = await fetch('/api/admin/retail/walk-in-sale', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, paymentMethod, note: note || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Sale failed')
      onSold()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Walk-In Sale</DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          Records the sale against the synthetic Retail Sale customer — used for non-tenant purchases.
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            No items yet.
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {items.map((it, idx) => {
              const p = products.find((x) => x._id === it.productId)
              return (
                <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <TextField
                    select size="small" SelectProps={{ native: true }}
                    value={it.productId}
                    onChange={(e) =>
                      setItems((rs) => rs.map((r, i) => i === idx ? { ...r, productId: e.target.value } : r))
                    }
                    sx={{ flex: 1 }}
                  >
                    {active.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} — ${(p.price / 100).toFixed(2)}
                        {p.inventory !== -1 ? ` (${p.inventory} in stock)` : ''}
                      </option>
                    ))}
                  </TextField>
                  <TextField
                    size="small" type="number"
                    value={it.quantity}
                    onChange={(e) =>
                      setItems((rs) => rs.map((r, i) => i === idx ? { ...r, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) } : r))
                    }
                    sx={{ width: 80 }}
                    inputProps={{ min: 1 }}
                  />
                  <IconButton size="small" onClick={() => setItems((rs) => rs.filter((_, i) => i !== idx))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              )
            })}
          </Box>
        )}
        <Button size="small" startIcon={<AddIcon />} onClick={addItem} sx={{ textTransform: 'none', mb: 2 }}>
          Add item
        </Button>

        <TextField
          select size="small" label="Payment method" fullWidth
          SelectProps={{ native: true }}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as any)}
          sx={{ mb: 1.5 }}
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="check">Check</option>
          <option value="other">Other</option>
        </TextField>
        <TextField
          size="small" label="Note (optional)" fullWidth multiline minRows={2}
          value={note} onChange={(e) => setNote(e.target.value)}
        />

        {error && <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1 }}>{error}</Typography>}

        <Box sx={{ mt: 2, py: 1.5, px: 2, bgcolor: '#FAF7F0', borderRadius: 1, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Total (incl. tax)</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>${(total / 100).toFixed(2)}</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSell} disabled={saving || items.length === 0} disableElevation>
          {saving ? 'Recording...' : 'Record Sale'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
