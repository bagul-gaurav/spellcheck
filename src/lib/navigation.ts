import { framer } from "@framer/plugin"

/** Select and scroll the canvas to the given node. */
export async function jumpToNode(nodeId: string): Promise<void> {
  await framer.setSelection([nodeId])
  await framer.zoomIntoView([nodeId])
}
