import React, { startTransition } from "react";

/*
TODO:
- check online status (https://tanstack.com/query/latest/docs/react/guides/network-mode)
- useQueryStates (for a list of queries)
- useMutationStates (for a list of mutations)
*/

// type QueryOptions = {
//   /** 0 to disable */
//   revalidateAfterMs: number;
//   /** 0 to stop retrying */
//   shouldRetryInMs(_: { retries: number; error: unknown }): number;
// };

// type QueryHookOptions = {
//   suspendData: boolean;
// };

// type Entry<Variables, Data> = {
//   revalidateAfterTimeoutId?: ReturnType<typeof setTimeout>;
//   retryTimeoutId?: ReturnType<typeof setTimeout>;
// };

// const defaultQueryOptions: QueryOptions = {
//   revalidateAfterMs: 5 * 60 * 1000,
//   shouldRetryInMs({ retries }) {
//     if (retries > 3) return 0;
//     return 1000 * Math.pow(retries, 2);
//   },
// };

// const defaultQueryHookOptions: QueryHookOptions = {
//   suspendData: true,
// };

//       const retryIt = (variables: Variables) => {
//         const entry = findEntry(variables);
//         const resolutions = Object.values(entry.resolutions).sort(
//           (a, b) => b.resolutionId - a.resolutionId
//         );
//         const lastResolution = resolutions[0];
//         if (lastResolution.status === "rejected") {
//           const error = lastResolution.error;
//           let retries = 0;
//           for (let i = 0; i < resolutions.length; i++) {
//             const resolution = resolutions[i];
//             if (resolution.status === "rejected") retries++;
//             else break;
//           }
//           const retryInMs = shouldRetryInMs!({ error, retries });
//           if (retryInMs > 0) {
//             entry.retryTimeoutId = setTimeout(() => {
//               query.resolve(variables);
//             }, retryInMs);
//           }
//         }
//       };
//       const garbageCollectResolutions = (entry: Entry<Variables, Data>) => {
//         const resolutions = Object.values(entry.resolutions).sort(
//           (a, b) => b.resolutionId - a.resolutionId
//         );
//         let startDeleting = false;
//         for (let i = 0; i < resolutions.length; i++) {
//           const resolution = resolutions[i];
//           if (startDeleting) delete entry.resolutions[resolution.resolutionId];
//           if (resolution.status !== "pending") startDeleting = true;
//         }
//       };
//       const garbageCollectEntries = () => {
//         for (const [variables, entry] of cache.entries()) {
//           garbageCollectResolutions(entry);
//           if (
//             entry.subscriptions.size === 0 &&
//             Object.values(entry.resolutions).every(
//               (resolution) =>
//                 resolution.status !== "pending" &&
//                 Date.now() - resolution.endTimestamp >= revalidateAfterMs
//             )
//           ) {
//             cache.delete(variables);
//           }
//         }
//       };
//       const query: Query<Variables, Data> = {
//         resolve(variables) {

//           const promise = resolver(variables);
//           promise.then(
//             (data) => {
//               if (entry.retryTimeoutId) {
//                 clearTimeout(entry.retryTimeoutId);
//               }
//               garbageCollectResolutions(entry);
//             },
//             (error) => {
//               retryIt(variables);
//               garbageCollectResolutions(entry);
//             }
//           );
//           if (revalidateAfterMs > 0) {
//             promise.finally(() => {
//               const entry = findEntry(variables);
//               if (entry.revalidateAfterTimeoutId) {
//                 clearTimeout(entry.revalidateAfterTimeoutId);
//               }
//               entry.revalidateAfterTimeoutId = setTimeout(() => {
//                 const entry = findEntry(variables);
//                 if (entry.subscriptions.size > 0) {
//                   query.resolve(variables);
//                 }
//               }, revalidateAfterMs);
//             });
//           }
//           garbageCollectResolutions(entry);

//         useQueryState(variables, hookOptions) {
//           const currentVariables = variablesRef.current;
//           const useDeferredValue = suspendData && handleLoading;
//           const deferredVariables = React.useDeferredValue(
//             useDeferredValue ? currentVariables : null
//           );
//           if (deferredVariables !== null && suspendData) {
//             query.read(deferredVariables);
//           }
//           if (suspendData) {
//             if (handleLoading) {
//               if (deferredVariables !== null) {
//                 query.read(deferredVariables);
//               }
//             } else {
//               if (currentVariables !== null) {
//                 query.read(currentVariables);
//               }
//             }
//           }
