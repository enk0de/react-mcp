export interface FiberNode {
  type: string | (Function & { displayName?: string });
  flags: number;
  subtreeFlags: number;
  deletions: FiberNode[] | null;
  _debugSource: {
    fileName: string;
  };
  memoizedState: { [key: string]: any } | null;
  [key: string]: any;
}
