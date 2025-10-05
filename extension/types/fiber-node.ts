export interface FiberNode {
  type: string | (Function & { displayName?: string });
  flags: number;
  subtreeFlags: number;
  deletions: FiberNode[] | null;
  return: FiberNode | null;
  memoizedState: { [key: string]: any } | null;
  memoizedProps: { [key: string]: any };
  [key: string]: any;
}
