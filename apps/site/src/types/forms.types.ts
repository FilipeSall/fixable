export type IssueSource = {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
};
