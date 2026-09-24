"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { createPedido } from "@/app/actions/pedidos"
import styles from "./cliente.module.css"

function cx(...values: Array<string | false | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(" "))
    .map((className) => styles[className] ?? className)
    .join(" ")
}

const colors = [
  { name: "Rojo", value: "red", hex: "#d32f2f" },
  { name: "Azul", value: "blue", hex: "#2563eb" },
  { name: "Amarillo", value: "yellow", hex: "#facc15" },
  { name: "Verde", value: "green", hex: "#16a34a" },
  { name: "Naranja", value: "orange", hex: "#f97316" },
  { name: "Violeta", value: "violet", hex: "#7c3aed" },
  { name: "Blanco", value: "white", hex: "#f8fafc" },
  { name: "Negro", value: "black", hex: "#171717" },
  { name: "Otros", value: "other", hex: "#737373" },
]

export function ClientePedidos() {
  const [submitted, setSubmitted] = useState(false)
  const [orderCode, setOrderCode] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [colorsOpen, setColorsOpen] = useState(false)
  const [delivery, setDelivery] = useState("pickup")
  const [menuOpen, setMenuOpen] = useState(false)
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const colorsMenuRef = useRef<HTMLDivElement | null>(null)
  const colorsTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!colorsOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      const clickedOutsideMenu = colorsMenuRef.current && !colorsMenuRef.current.contains(target)
      const clickedOutsideTrigger = colorsTriggerRef.current && !colorsTriggerRef.current.contains(target)

      if (clickedOutsideMenu && clickedOutsideTrigger) {
        setColorsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [colorsOpen])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget

    if (selectedColors.length === 0) {
      setError("Seleccioná al menos un color.")
      return
    }

    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    setPending(true)
    setError("")
    const result = await createPedido(new FormData(form))
    setPending(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setOrderCode(result.codigo)
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (submitted) {
    return (
      <main className={cx("cliente-root", "order-page")}>
        <div className={cx("app-shell")}>
          <aside className={cx("sidebar")}>
            <div className={cx("brand-mark")}>J3D - IMPRESIONES</div>
            <nav aria-label="Navegación principal">
              <a className={cx("nav-item active")} href="#pedido"><span className={cx("nav-dot")} />Nuevo pedido</a>
              <a className={cx("nav-item")} href="/cliente/consultar-pedido"><span className={cx("nav-dot")} />Consultar Pedido</a>
            </nav>
            <p className={cx("sidebar-footer")}>Pedidos a medida</p>
          </aside>
          <section className={cx("content-area")}>
            <div className={cx("mobile-topbar")}>
              <div className={cx("brand-mark")}>J3D - IMPRESIONES</div>
            </div>
            <div className={cx("order-shell success-shell")}>
              <section className={cx("success-card")} aria-labelledby="success-title">
                <div className={cx("success-icon")} aria-hidden="true">✓</div>
                <p className={cx("eyebrow")}>Pedido recibido</p>
                <h1 id="success-title">Pedido #{orderCode} registrado</h1>
                <p className={cx("success-copy")}>Gracias por contarnos cómo querés tu producto. Vamos a revisar los detalles y preparar tu presupuesto.</p>
                <div className={cx("status-badge")}><span /> Pendiente de presupuesto</div>
                <button className={cx("secondary-button")} type="button" onClick={() => {
                  setSubmitted(false)
                  setQuantity(1)
                  setSelectedColors([])
                  setDelivery("pickup")
                  setPhone("")
                }}>Crear otro pedido</button>
              </section>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className={cx("cliente-root", "order-page")}>
      <div className={cx("app-shell")}>
        <aside className={cx(`sidebar ${menuOpen ? "open" : ""}`)}>
          <div className={cx("brand-mark")}>J3D - IMPRESIONES</div>
          <nav aria-label="Navegación principal">
            <a className={cx("nav-item active")} href="#pedido" onClick={() => setMenuOpen(false)}><span className={cx("nav-dot")} />Nuevo pedido</a>
            <a className={cx("nav-item")} href="/cliente/consultar-pedido" onClick={() => setMenuOpen(false)}><span className={cx("nav-dot")} />Consultar Pedido</a>
          </nav>
          <p className={cx("sidebar-footer")}>Pedidos a medida</p>
        </aside>
        <section className={cx("content-area")}>
          <div className={cx("mobile-topbar")}>
            <div className={cx("brand-mark")}>J3D - IMPRESIONES</div>
            <button className={cx("menu-button")} type="button" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          </div>
          <div className={cx("order-shell")}>
            <header className={cx("page-header")} id="pedido">
              <div className={cx("desktop-brand brand-mark")}>J3D - IMPRESIONES</div>
              <p className={cx("eyebrow")}>Pedidos a medida</p>
              <h1>Nuevo pedido personalizado</h1>
              <p className={cx("intro")}>Contanos cómo querés tu producto y te armamos el presupuesto.</p>
            </header>
            <form className={cx("order-form")} onSubmit={handleSubmit}>
              <section className={cx("form-section")} aria-labelledby="product-details">
                <div className={cx("section-heading")}>
                  <span className={cx("section-number")}>01</span>
                  <div>
                    <h2 id="product-details">Detalles del producto</h2>
                    <p>Definí las características de tu pedido.</p>
                  </div>
                </div>
                <div className={cx("field-grid")}>
                  <label className={cx("field")}>
                    <span>Tipo de producto <b>*</b></span>
                    <select name="producto" required defaultValue="">
                      <option value="" disabled>Elegí una opción</option>
                      <option>Mate</option>
                      <option>Llavero</option>
                      <option>Medalla</option>
                      <option>Vaso</option>
                      <option>Juguete</option>
                      <option>Maceta</option>
                      <option>Soporte</option>
                      <option>Otros</option>
                    </select>
                  </label>
                  <fieldset className={cx("field color-field")}>
                    <legend>Colores <b>*</b></legend>
                    <div className={cx("multi-select")}>
                      <button
                        ref={colorsTriggerRef}
                        className={cx("multi-select-trigger", colorsOpen && "open", selectedColors.length > 0 && "has-value")}
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={colorsOpen}
                        onClick={() => setColorsOpen((current) => !current)}
                      >
                        {selectedColors.length ? `${selectedColors.length} seleccionado${selectedColors.length > 1 ? "s" : ""}` : "Elegí uno o más colores"}
                        <span aria-hidden="true">⌄</span>
                      </button>
                      {colorsOpen && (
                        <div ref={colorsMenuRef} className={cx("multi-select-menu")} role="listbox" aria-label="Colores disponibles">
                          {colors.map((item) => (
                            <label key={item.value} className={cx("color-check")}>
                              <input
                                type="checkbox"
                                name="colors"
                                value={item.value}
                                checked={selectedColors.includes(item.value)}
                                onChange={() => setSelectedColors((current) => current.includes(item.value) ? current.filter((value) => value !== item.value) : [...current, item.value])}
                              />
                              <span className={cx("swatch")} style={{ backgroundColor: item.hex }} />
                              <span>{item.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <input className={cx("visually-hidden-required")} tabIndex={-1} value={selectedColors.join(",")} onChange={() => undefined} aria-label="Seleccioná al menos un color" />
                  </fieldset>
                  <div className={cx("field")}>
                    <span id="quantity-label">Cantidad <b>*</b></span>
                    <div className={cx("stepper")} aria-labelledby="quantity-label">
                      <button type="button" aria-label="Restar cantidad" onClick={() => setQuantity((current) => Math.max(1, Number(current) - 1))}>−</button>
                      <input
                        aria-label="Cantidad"
                        type="number"
                        min={1}
                        step={1}
                        value={quantity}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value)
                          setQuantity(Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 1)
                        }}
                      />
                      <button type="button" aria-label="Sumar cantidad" onClick={() => setQuantity((current) => Number(current) + 1)}>+</button>
                    </div>
                    <input type="hidden" name="cantidad" value={quantity} />
                  </div>
                  <label className={cx("field full-width")}>
                    <span>Archivo de referencia <small>(opcional · .jpeg, .png, .jpg, .pdf)</small></span>
                    <input
                      className={cx("file-input")}
                      type="file"
                      name="archivo"
                      accept=".jpeg,.png,.jpg,.pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) {
                          event.currentTarget.setCustomValidity("")
                          return
                        }
                        const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
                        const extension = file.name.toLowerCase().split(".").pop()
                        const isAllowed = allowedTypes.includes(file.type) && ["jpeg", "jpg", "png", "pdf"].includes(extension ?? "")
                        event.currentTarget.setCustomValidity(isAllowed ? "" : "Solo se permiten archivos .jpeg, .png, .jpg o .pdf.")
                        if (!isAllowed) event.currentTarget.value = ""
                      }}
                    />
                  </label>
                  <label className={cx("field full-width")}>
                    <span>Diseño requerido <b>*</b></span>
                    <textarea name="diseno" required rows={5} placeholder="Describí detalles del diseño específico" />
                  </label>
                </div>
              </section>
              <section className={cx("form-section")} aria-labelledby="delivery-details">
                <div className={cx("section-heading")}>
                  <span className={cx("section-number")}>02</span>
                  <div>
                    <h2 id="delivery-details">Datos de entrega</h2>
                    <p>Así podemos coordinar cuando esté listo.</p>
                  </div>
                </div>
                <div className={cx("field-grid")}>
                  <label className={cx("field")}><span>Nombre <b>*</b></span><input name="nombre" required type="text" placeholder="Tu nombre" /></label>
                  <label className={cx("field")}><span>Apellido <b>*</b></span><input name="apellido" required type="text" placeholder="Tu apellido" /></label>
                  <label className={cx("field")}><span>Email <b>*</b></span><input name="email" required type="email" placeholder="tu@email.com" /></label>
                  <label className={cx("field")}>
                    <span>Número de teléfono <b>*</b></span>
                    <input
                      name="telefono"
                      required
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                      title="Ingresá un número de teléfono"
                      placeholder="3884449358"
                    />
                  </label>
                  <fieldset className={cx("field full-width")}>
                    <legend>Modalidad de entrega <b>*</b></legend>
                    <div className={cx("radio-list")}>
                      <label className={cx(`radio-card ${delivery === "pickup" ? "selected" : ""}`)}>
                        <input type="radio" name="delivery" value="pickup" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} required />
                        <span><strong>Retiro en local</strong><small>Te avisamos cuando esté listo</small></span>
                      </label>
                      <label className={cx(`radio-card ${delivery === "shipping" ? "selected" : ""}`)}>
                        <input type="radio" name="delivery" value="shipping" checked={delivery === "shipping"} onChange={() => setDelivery("shipping")} />
                        <span><strong>Envío a domicilio</strong><small>Coordinamos la entrega en tu dirección</small></span>
                      </label>
                    </div>
                  </fieldset>
                  {delivery === "shipping" && (
                    <div className={cx("field-grid full-width address-fields")}>
                      <label className={cx("field full-width")}><span>Domicilio <b>*</b></span><input name="domicilio" required type="text" placeholder="Calle y N°" /></label>
                      <label className={cx("field")}><span>Ciudad <b>*</b></span><input name="ciudad" required type="text" placeholder="Tu ciudad" /></label>
                      <label className={cx("field")}><span>Código postal <b>*</b></span><input name="codigo_postal" required type="text" placeholder="Código postal" /></label>
                    </div>
                  )}
                </div>
              </section>
              <div className={cx("form-actions")}>
                <p><b>*</b> Campos obligatorios{error ? ` · ${error}` : ""}</p>
                <button className={cx("primary-button")} type="submit" disabled={pending}>
                  {pending ? "Guardando..." : "Confirmar pedido"} <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
