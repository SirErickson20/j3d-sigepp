'use client'

import { useEffect, useState } from 'react'
import { Check, Save, SlidersHorizontal } from 'lucide-react'
import { guardarParametrosCotizacion, listarParametrosCotizacion } from '@/app/actions/pedidos'
import { COTIZACION_FIELDS, type CotizacionFieldKey, type CotizacionValues } from '@/lib/pedidos/types'
import { cotizacionToFormValues } from '@/lib/pedidos/mappers'
import { cx } from './cx'
import { PageFrame, Panel } from './PageFrame'

const emptyCotizacionValues: CotizacionValues = {
  precioMaterialKg: '',
  energiaImporte: '',
  energiaDias: '',
  valorImpresora: '',
  porcentajeMantenimiento: '',
  vidaUtilAnos: '',
  manoObraHora: '',
  porcentajeImpuestos: '',
  lacaCm3Envase: '',
  lacaCm3PorPieza: '',
  lacaPrecio: '',
  acetonaPrecioCm3: '',
}

export function OperadorCotizacion() {
  const [values, setValues] = useState<CotizacionValues>(emptyCotizacionValues)
  const [updated, setUpdated] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void listarParametrosCotizacion().then((result) => {
      if (!result.ok) {
        setError(result.error)
        return
      }
      setValues(cotizacionToFormValues(result.cotizacion))
      setUpdated(result.cotizacion.updated)
    })
  }, [])

  const handleValueChange = (key: CotizacionFieldKey, value: string) => {
    if (value === '' || Number(value) >= 0) {
      setValues((current) => ({ ...current, [key]: value }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await guardarParametrosCotizacion(values)
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setValues(cotizacionToFormValues(result.cotizacion))
    setUpdated(result.cotizacion.updated)
    setConfirmation('Parámetros actualizados. Se guardó una nueva versión de cotización.')
  }

  return (
    <PageFrame
      breadcrumb={['Gestión', 'Cotización']}
      eyebrow="CONFIGURACIÓN"
      title="Parámetros de cotización"
      description="Valores base del cálculo de costos. Cada guardado deja una versión nueva para los presupuestos."
    >
      <Panel eyebrow="VALORES BASE" title="Precios y consumos" extra={<SlidersHorizontal className={cx("settings-heading-icon")} />}>
        <div className={cx("parameters-form")}>
          {COTIZACION_FIELDS.map((field) => (
            <label className={cx("parameter-field")} key={field.key}>
              <span className={cx("parameter-label")}>{field.label}</span>
              <span className={cx("parameter-input-row")}>
                <input
                  type="number"
                  min={field.min}
                  step="any"
                  value={values[field.key]}
                  placeholder="Ingresá el valor"
                  onChange={(event) => handleValueChange(field.key, event.target.value)}
                />
                <span className={cx("parameter-unit")}>{field.unit}</span>
              </span>
              {updated && <span className={cx("parameter-updated")}>Última actualización: {updated}</span>}
            </label>
          ))}
        </div>
        <div className={cx("settings-footer")}>
          <div>
            {error && <p className={cx("status-confirmation")} role="status">{error}</p>}
            {confirmation && <p className={cx("settings-confirmation")} role="status"><Check />{confirmation}</p>}
          </div>
          <button className={cx("primary-button save-button")} onClick={handleSave} disabled={saving}>
            <Save />{saving ? 'Guardando...' : 'Guardar parámetros'}
          </button>
        </div>
      </Panel>
    </PageFrame>
  )
}
