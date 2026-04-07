import PDFDocument from 'pdfkit'
import { formatMoney, formatDate } from './utils'

interface LeaseData {
  tenantName: string
  tenantEmail: string
  unitNumber: string
  unitSize: string
  monthlyRate: number
  deposit: number
  proratedFirstMonth: number
  startDate: Date
  billingDay: number
  signatureData?: string
}

interface ReceiptData {
  tenantName: string
  unitNumber: string
  amount: number
  type: string
  periodStart: Date
  periodEnd: Date
  paymentDate: Date
  paymentIntentId: string
}

export function generateLease(data: LeaseData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Tuscany Village Self Storage', { align: 'center' })
    doc.fontSize(14).font('Helvetica').text('Rental Agreement', { align: 'center' })
    doc.moveDown(2)

    // Tenant info
    doc.fontSize(12).font('Helvetica-Bold').text('Tenant Information')
    doc.font('Helvetica')
    doc.text(`Name: ${data.tenantName}`)
    doc.text(`Email: ${data.tenantEmail}`)
    doc.moveDown()

    // Unit info
    doc.font('Helvetica-Bold').text('Unit Information')
    doc.font('Helvetica')
    doc.text(`Unit: ${data.unitNumber}`)
    doc.text(`Size: ${data.unitSize}`)
    doc.text(`Monthly Rate: ${formatMoney(data.monthlyRate)}`)
    doc.text(`Security Deposit: ${formatMoney(data.deposit)}`)
    doc.text(`Prorated First Month: ${formatMoney(data.proratedFirstMonth)}`)
    doc.moveDown()

    // Lease terms
    doc.font('Helvetica-Bold').text('Lease Terms')
    doc.font('Helvetica')
    doc.text(`Start Date: ${formatDate(data.startDate)}`)
    doc.text(`Billing Day: ${data.billingDay} of each month`)
    doc.text('Term: Month-to-month')
    doc.moveDown()

    // Terms and conditions
    doc.font('Helvetica-Bold').text('Terms and Conditions')
    doc.font('Helvetica').fontSize(10)
    doc.text('1. Rent is due on the billing day of each month. A grace period of 5 days is provided.')
    doc.text('2. Late fees will be assessed after the grace period at $25.00 per occurrence.')
    doc.text('3. Failure to pay after 10 days will result in lockout of the storage unit.')
    doc.text('4. Tenant must provide 30 days notice before moving out.')
    doc.text('5. Facility hours are 6:00 AM to 10:00 PM daily.')
    doc.text('6. Tenant is responsible for maintaining insurance on stored items.')
    doc.moveDown(2)

    // Signature
    if (data.signatureData) {
      doc.font('Helvetica-Bold').fontSize(12).text('Signature:')
      try {
        const imgData = data.signatureData.replace(/^data:image\/\w+;base64,/, '')
        const imgBuffer = Buffer.from(imgData, 'base64')
        doc.image(imgBuffer, { width: 200, height: 60 })
      } catch {
        doc.text('[Signature on file]')
      }
    }

    doc.text(`Date: ${formatDate(new Date())}`)

    doc.end()
  })
}

export function generateReceipt(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A5' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Tuscany Village Self Storage', { align: 'center' })
    doc.fontSize(14).text('Payment Receipt', { align: 'center' })
    doc.moveDown()

    // Receipt details
    doc.fontSize(11).font('Helvetica')
    doc.text(`Tenant: ${data.tenantName}`)
    doc.text(`Unit: ${data.unitNumber}`)
    doc.text(`Payment Type: ${data.type.replace('_', ' ').toUpperCase()}`)
    doc.text(`Amount: ${formatMoney(data.amount)}`)
    doc.text(`Period: ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`)
    doc.text(`Payment Date: ${formatDate(data.paymentDate)}`)
    doc.text(`Reference: ${data.paymentIntentId}`)
    doc.moveDown(2)

    doc.fontSize(9).text('Thank you for your payment!', { align: 'center' })

    doc.end()
  })
}
