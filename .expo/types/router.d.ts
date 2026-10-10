/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/`; params?: Router.UnknownInputParams; } | { pathname: `/pdf`; params?: Router.UnknownInputParams; } | { pathname: `/spreadsheet`; params?: Router.UnknownInputParams; } | { pathname: `/../src/components/SafeAreaContainer`; params?: Router.UnknownInputParams; } | { pathname: `/../src/safe-area-bridge`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/`; params?: Router.UnknownOutputParams; } | { pathname: `/pdf`; params?: Router.UnknownOutputParams; } | { pathname: `/spreadsheet`; params?: Router.UnknownOutputParams; } | { pathname: `/../src/components/SafeAreaContainer`; params?: Router.UnknownOutputParams; } | { pathname: `/../src/safe-area-bridge`; params?: Router.UnknownOutputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; };
      href: Router.RelativePathString | Router.ExternalPathString | `/${`?${string}` | `#${string}` | ''}` | `/pdf${`?${string}` | `#${string}` | ''}` | `/spreadsheet${`?${string}` | `#${string}` | ''}` | `/../src/components/SafeAreaContainer${`?${string}` | `#${string}` | ''}` | `/../src/safe-area-bridge${`?${string}` | `#${string}` | ''}` | `/_sitemap${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/`; params?: Router.UnknownInputParams; } | { pathname: `/pdf`; params?: Router.UnknownInputParams; } | { pathname: `/spreadsheet`; params?: Router.UnknownInputParams; } | { pathname: `/../src/components/SafeAreaContainer`; params?: Router.UnknownInputParams; } | { pathname: `/../src/safe-area-bridge`; params?: Router.UnknownInputParams; } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; };
    }
  }
}
