export { DEFAULT_TEAM_ID, remoteCacheHandlers } from '../../protocol/remote-cache';
export { createArtifactRouter } from '../../protocol/remote-cache';

import { createArtifactRouter } from '../../protocol/remote-cache';

/** @deprecated Import createArtifactRouter from the remote-cache protocol module. */
export const artifactRouter = createArtifactRouter();
