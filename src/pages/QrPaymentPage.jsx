import React, { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Buffer } from 'buffer'
import { useNotifications } from '../contexts/NotificationContext'
import { useQubicConnect } from '../contexts/QubicConnectContext'
import { buildReceivePaymentTx } from '../components/api/HM25Api'

const QrPaymentPage = () => {
    const [amount, setAmount] = useState(0)
    const [description, setDescription] = useState('')
    const [qrData, setQrData] = useState(null)
    const [paymentConfirmed, setPaymentConfirmed] = useState(false)
    const [inputError, setInputError] = useState(false)

    const { addNotification } = useNotifications()
    const { wallet, signTransaction, getTick, httpEndpoint: rpcUrl } = useQubicConnect()

    const processPayment = async ({ amount }) => {
        try {
            const amountInt = parseInt(amount)
                if (isNaN(amountInt) || amountInt <= 0) {
                throw new Error('Monto no válido. Debe ser un número entero positivo.')
            }
            const amountInUQU = amountInt * 1_000_000
            const tick = await getTick()

            const qHelperModule = await import('@qubic-lib/qubic-ts-library/dist/qubicHelper')
            const qHelper = new qHelperModule.QubicHelper()

            const sourcePublicKey = qHelper.getIdentityBytes(wallet.publicKey)
            const tx = await buildReceivePaymentTx(qHelper, sourcePublicKey, tick, amountInUQU)
            const signedTx = await signTransaction(tx)

            const response = await fetch(`${rpcUrl}/v1/broadcast-transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionData: Buffer.from(signedTx).toString('base64'),
                }),
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(`Error RPC: ${error}`)
            }

            addNotification({
                type: 'success',
                title: 'Pago recibido',
                message: `Recibiste ${amount} QU a través del contrato.`,
            })

            const saved = (parseFloat(amount) * 0.1).toFixed(2)
            addNotification({
                type: 'saving',
                title: 'Ahorro automático',
                message: `Se guardó el 10% de tu pago: $${saved}.`,
            })

            setPaymentConfirmed(true)
            setAmount('')
            setDescription('')
            setQrData(null)
        } catch (err) {
            console.error(err)
            addNotification({
                type: 'error',
                title: 'Error en la transacción',
                message: err.message,
            })
        }
    }

    const generateQR = () => {
        if (!amount || isNaN(amount)) return alert('Introduce un monto válido')
        const data = {
            amount: parseFloat(amount),
            description,
            timestamp: new Date().toISOString(),
        }
        setQrData(JSON.stringify(data))
        setPaymentConfirmed(false)
    }

    const handleInputChange = (e) => {
        const value = e.target.value
        const isValid = /^\d+$/.test(value) || value === ''
        if (isValid) {
            setAmount(value)
            setInputError(false)
        } else {
            setInputError(true)
        }
    }

    return (
        <div className="p-6 max-w-2xl mx-auto text-white space-y-8">
            <h1 className="text-3xl font-bold text-primary-50">Pago con QR</h1>

            <div className="space-y-4">
                <input
                    type="number"
                    inputMode="numeric"
                    value={parseInt(amount)}
                    onChange={handleInputChange}
                    placeholder="Monto a pagar"
                    className={`w-full p-3 rounded-lg bg-gray-800 text-white placeholder-gray-400 border ${
                        inputError ? 'border-red-500' : 'border-transparent'
                    }`}
                />
                {inputError && (
                    <p className="text-red-500 text-sm animate-blink">
                        Solo se permiten números positivos con hasta 2 decimales.
                    </p>
                )}

                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción"
                    className="w-full p-3 rounded-lg bg-gray-800 text-white placeholder-gray-400"
                />

                <button
                    onClick={generateQR}
                    className="bg-primary-50 text-black font-semibold px-6 py-3 rounded-lg hover:bg-primary-40 transition"
                >
                    Generar QR
                </button>
            </div>

            {qrData && (
                <div className="flex flex-col items-center gap-4 mt-6">
                    <QRCodeCanvas value={qrData} size={200} />
                    <button
                        onClick={() => processPayment({ amount, description })}
                        className="mt-4 bg-green-500 text-white px-5 py-2 rounded-lg hover:bg-green-600 transition"
                    >
                        Simular escaneo y pago
                    </button>
                </div>
            )}

            {paymentConfirmed && (
                <div className="bg-green-900 text-green-200 p-4 mt-6 rounded-xl text-center shadow-lg">
                    ✅ Pago confirmado y se ha ahorrado el 10% automáticamente.
                </div>
            )}
        </div>
    )
}

export default QrPaymentPage
