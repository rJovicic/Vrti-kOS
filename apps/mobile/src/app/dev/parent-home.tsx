import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

// Development-only Parent Home design preview (synthetic data). In production `__DEV__` is false: Metro folds the
// condition, the preview module and its fixtures are not bundled, and the route redirects to the normal entry.
// Open in development with: vrticos://dev/parent-home (or `/dev/parent-home` in the dev client).
const Preview: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional require keeps fixtures out of production bundles
    (require('../../features/guardian-home/preview/ParentHomePreview') as typeof import('../../features/guardian-home/preview/ParentHomePreview')).ParentHomePreview
  : null;

export default function ParentHomePreviewRoute() {
  if (!Preview) return <Redirect href="/" />;
  return <Preview />;
}
