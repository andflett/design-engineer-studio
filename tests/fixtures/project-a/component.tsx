import styles from "./component.module.css";

export function Card() {
  return (
    <div className={styles.card}>
      <p className={styles["card-body"]}>Content</p>
    </div>
  );
}
