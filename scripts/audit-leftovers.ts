import mongoose from 'mongoose'
const URI = process.env.MONGODB_URI!
const fmt = (c:number)=>`$${(c/100).toFixed(2)}`
async function main() {
  await mongoose.connect(URI)
  const db = mongoose.connection.db!
  const tenants = await db.collection('tenants').find({ $or: [{ status: 'locked_out' }, { balance: { $ne: 0 } }] }).toArray()
  const noLease: any[] = []
  for (const t of tenants) {
    const active = await db.collection('leases').findOne({ tenantId: t._id, status: 'active' })
    if (!active) {
      const anyLease = await db.collection('leases').find({ tenantId: t._id }).toArray()
      const states = anyLease.map(l=>l.status)
      noLease.push({ name:`${t.firstName} ${t.lastName}`, email:t.email, bal:t.balance, status:t.status, leases: states.join(',')||'NONE' })
    }
  }
  const seed = noLease.filter(t=>/@example\.com$|@tuscanystorage\.local$/i.test(t.email))
  const real = noLease.filter(t=>!/@example\.com$|@tuscanystorage\.local$/i.test(t.email))
  const p=(t:any)=>`  ${t.name} | ${t.email} | bal ${fmt(t.bal)} | tenant=${t.status} | leases=[${t.leases}]`
  console.log(`=== REAL emails, no active lease (${real.length}) ===`)
  real.sort((a,b)=>a.bal-b.bal).forEach(t=>console.log(p(t)))
  console.log(`\n=== SEED / placeholder (${seed.length}) — @example.com / @tuscanystorage.local ===`)
  seed.forEach(t=>console.log(p(t)))
  await mongoose.disconnect()
}
main().catch((e)=>{console.error(e);process.exit(1)})
