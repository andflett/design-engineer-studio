import styles from "./StatusCard.module.css";

export function StatusCard({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.card} data-testid="module-card">
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
