export interface FiberNode {
  type: string | Function;
  flags: number;
  subtreeFlags: number;
  deletions: FiberNode[] | null;
  _debugSource: {
    fileName: string;
  };
  [key: string]: any;
}
