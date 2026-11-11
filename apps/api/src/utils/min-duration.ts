/** Espera a tarefa e no mínimo `ms` milissegundos, para o tempo de resposta não revelar o caminho que ela seguiu. */
export async function withMinimumDuration<T>(ms: number, task: Promise<T>): Promise<T> {
  const [result] = await Promise.all([task, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
  return result;
}
