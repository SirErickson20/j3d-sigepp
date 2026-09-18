import Link from "next/link";
import styles from "@/components/home/home.module.css";

export default function Home() {
  return (
    <div className={styles.home}>
      <div className={styles.shell}>
        <p className={styles.brand}>J3D - Impresiones</p>
        <h1>Elegí cómo entrar</h1>
        <p className={styles.intro}>Pedí un producto personalizado o gestioná los pedidos de la tienda.</p>
        <div className={styles.cards}>
          <Link href="/cliente" className={styles.card}>
            <span>Cliente</span>
            <strong>Nuevo pedido</strong>
            <p>Cargá tu diseño, colores y entrega para recibir un presupuesto.</p>
            <em>Ir al formulario →</em>
          </Link>
          <Link href="/operador" className={styles.card}>
            <span>Operador</span>
            <strong>Panel de tienda</strong>
            <p>Revisá pedidos, cotizá y enviá el presupuesto al cliente.</p>
            <em>Ir al panel →</em>
          </Link>
        </div>
      </div>
    </div>
  );
}
