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
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) setValue(product.inventory.toString())
  }, [product, open])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product?._id, inventory: parseInt(value, 10) }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error)
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Update Inventory — {product?.name}</DialogTitle>
      <DialogContent>
        <TextField
          label="Inventory Count"
          fullWidth size="small" type="number"
          value={value} onChange={(e) => setValue(e.target.value)}
          helperText="-1 = unlimited"
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} disableElevation>
          {saving ? 'Saving...' : 'Update'}
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
        sx={{ fontWeight: 700, color: '#1C0F06', fontFamily: '"Playfair Display", serif', mb: 1 }}
      >
        Retail Sale
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Products can be sold while renting a unit to a tenant or added separately later.
      </Typography>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, pb: 0 }}>
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
                      bgcolor: '#1C0F06', color: 'white', fontWeight: 600, fontSize: '0.8rem',
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
                      '& td': { borderColor: '#EDE5D8' },
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
    </Box>
  )
}
