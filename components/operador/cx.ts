import styles from "./operador.module.css";

export function cx(...values: Array<string | false | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(" "))
    .map((className) => styles[className] ?? className)
    .join(" ");
}
