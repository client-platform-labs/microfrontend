import path from "node:path";
import { PLAYGROUND_DIR } from "../types.js";

export function playgroundRoot(cwd: string): string {
  return path.join(cwd, PLAYGROUND_DIR);
}

export function hostDir(cwd: string): string {
  return path.join(playgroundRoot(cwd), "host");
}

export function remoteDir(cwd: string, name: string): string {
  return path.join(playgroundRoot(cwd), "remotes", name);
}
