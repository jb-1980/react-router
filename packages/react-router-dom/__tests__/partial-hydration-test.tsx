import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import type { LoaderFunction } from "react-router";
import { RouterProvider as ReactRouter_RouterPRovider } from "react-router";
import {
  Outlet,
  RouterProvider as ReactRouterDom_RouterProvider,
  createBrowserRouter,
  createHashRouter,
  createMemoryRouter,
  useLoaderData,
  useRouteError,
} from "react-router-dom";

import getHtml from "../../react-router/__tests__/utils/getHtml";
import { createDeferred, tick } from "../../router/__tests__/utils/utils";

let didAssertMissingHydrateFallback = false;

describe("v7_partialHydration", () => {
  describe("createBrowserRouter", () => {
    testPartialHydration(createBrowserRouter, ReactRouterDom_RouterProvider);
  });

  describe("createHashRouter", () => {
    testPartialHydration(createHashRouter, ReactRouterDom_RouterProvider);
  });

  describe("createMemoryRouter", () => {
    testPartialHydration(createMemoryRouter, ReactRouter_RouterPRovider);
  });
});

function testPartialHydration(
  createTestRouter:
    | typeof createBrowserRouter
    | typeof createHashRouter
    | typeof createMemoryRouter,
  RouterProvider:
    | typeof ReactRouterDom_RouterProvider
    | typeof ReactRouter_RouterPRovider
) {
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  it("does not handle partial hydration by default", async () => {
    let router = createTestRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => "ROOT",
          Component() {
            let data = useLoaderData() as string;
            return (
              <>
                <h1>{`Home - ${data}`}</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              loader: () => "INDEX",
              HydrateFallback: () => <p>Should not see me</p>,
              Component() {
                let data = useLoaderData() as string;
                return <h2>{`Index - ${data}`}</h2>;
              },
            },
          ],
        },
      ],
      {
        hydrationData: {
          loaderData: {
            root: "HYDRATED ROOT",
          },
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <h2>
          Index - undefined
        </h2>
      </div>"
    `);
  });

  it("supports partial hydration w/leaf fallback", async () => {
    let dfd = createDeferred();
    let router = createTestRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => "ROOT",
          Component() {
            let data = useLoaderData() as string;
            return (
              <>
                <h1>{`Home - ${data}`}</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              loader: () => dfd.promise,
              HydrateFallback: () => <p>Index Loading...</p>,
              Component() {
                let data = useLoaderData() as string;
                return <h2>{`Index - ${data}`}</h2>;
              },
            },
          ],
        },
      ],
      {
        hydrationData: {
          loaderData: {
            root: "HYDRATED ROOT",
          },
        },
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <p>
          Index Loading...
        </p>
      </div>"
    `);

    dfd.resolve("INDEX DATA");
    await waitFor(() => screen.getByText(/INDEX DATA/));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <h2>
          Index - INDEX DATA
        </h2>
      </div>"
    `);
  });

  it("supports partial hydration w/root fallback", async () => {
    let dfd = createDeferred();
    let router = createTestRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => "ROOT",
          HydrateFallback: () => <p>Root Loading...</p>,
          Component() {
            let data = useLoaderData() as string;
            return (
              <>
                <h1>{`Home - ${data}`}</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              loader: () => dfd.promise,
              Component() {
                let data = useLoaderData() as string;
                return <h2>{`Index - ${data}`}</h2>;
              },
            },
          ],
        },
      ],
      {
        hydrationData: {
          loaderData: {
            root: "HYDRATED ROOT",
          },
        },
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <p>
          Root Loading...
        </p>
      </div>"
    `);

    dfd.resolve("INDEX DATA");
    await waitFor(() => screen.getByText(/INDEX DATA/));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <h2>
          Index - INDEX DATA
        </h2>
      </div>"
    `);
  });

  it("supports partial hydration w/no fallback", async () => {
    let dfd = createDeferred();
    let router = createTestRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => "ROOT",
          Component() {
            let data = useLoaderData() as string;
            return (
              <>
                <h1>{`Home - ${data}`}</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              loader: () => dfd.promise,
              Component() {
                let data = useLoaderData() as string;
                return <h2>{`Index - ${data}`}</h2>;
              },
            },
          ],
        },
      ],
      {
        hydrationData: {
          loaderData: {
            root: "HYDRATED ROOT",
          },
        },
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`"<div />"`);

    // We can't assert this in all 3 test executions because we use `warningOnce`
    // internally to avoid logging on every render
    if (!didAssertMissingHydrateFallback) {
      didAssertMissingHydrateFallback = true;
      // eslint-disable-next-line jest/no-conditional-expect
      expect(consoleWarn).toHaveBeenCalledWith(
        "No `HydrateFallback` element provided to render during initial hydration"
      );
    }

    dfd.resolve("INDEX DATA");
    await waitFor(() => screen.getByText(/INDEX DATA/));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <h2>
          Index - INDEX DATA
        </h2>
      </div>"
    `);
  });

  it("deprecates fallbackElement", async () => {
    let dfd1 = createDeferred();
    let dfd2 = createDeferred();
    let router = createTestRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => dfd1.promise,
          HydrateFallback: () => <p>Root Loading...</p>,
          Component() {
            let data = useLoaderData() as string;
            return (
              <>
                <h1>{`Home - ${data}`}</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              loader: () => dfd2.promise,
              Component() {
                let data = useLoaderData() as string;
                return <h2>{`Index - ${data}`}</h2>;
              },
            },
          ],
        },
      ],
      {
        hydrationData: {
          loaderData: {
            root: "HYDRATED ROOT",
          },
        },
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(
      <RouterProvider
        router={router}
        fallbackElement={<p>fallbackElement...</p>}
      />
    );

    expect(getHtml(container)).toMatchInlineSnapshot(`
          "<div>
            <p>
              Root Loading...
            </p>
          </div>"
        `);

    expect(consoleWarn).toHaveBeenCalledWith(
      "`<RouterProvider fallbackElement>` is deprecated when using " +
        "`v7_partialHydration`, use a `HydrateFallback` component instead"
    );

    dfd1.resolve("ROOT DATA");
    dfd2.resolve("INDEX DATA");
    await waitFor(() => screen.getByText(/INDEX DATA/));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <h2>
          Index - INDEX DATA
        </h2>
      </div>"
    `);
  });

  it("does not re-run loaders that don't have loader data due to errors", async () => {
    let spy = jest.fn();
    let router = createTestRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => "ROOT",
          Component() {
            let data = useLoaderData() as string;
            return (
              <>
                <h1>{`Home - ${data}`}</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              loader: spy,
              HydrateFallback: () => <p>Index Loading...</p>,
              Component() {
                let data = useLoaderData() as string;
                return <h2>{`Index - ${data}`}</h2>;
              },
              ErrorBoundary() {
                let error = useRouteError() as string;
                return <p>{error}</p>;
              },
            },
          ],
        },
      ],
      {
        hydrationData: {
          loaderData: {
            root: "HYDRATED ROOT",
          },
          errors: {
            index: "INDEX ERROR",
          },
        },
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <p>
          INDEX ERROR
        </p>
      </div>"
    `);

    expect(spy).not.toHaveBeenCalled();
  });

  it("lets users force hydration loader execution with loader.hydrate=true", async () => {
    let dfd = createDeferred();
    let indexLoader: LoaderFunction = () => dfd.promise;
    indexLoader.hydrate = true;
    let router = createTestRouter(
      [
        {
          id: "root",
          path: "/",
          loader: () => "ROOT",
          Component() {
            let data = useLoaderData() as string;
            return (
              <>
                <h1>{`Home - ${data}`}</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              loader: indexLoader,
              HydrateFallback: () => <p>Index Loading...</p>,
              Component() {
                let data = useLoaderData() as string;
                return <h2>{`Index - ${data}`}</h2>;
              },
            },
          ],
        },
      ],
      {
        hydrationData: {
          loaderData: {
            root: "HYDRATED ROOT",
            index: "INDEX INITIAL",
          },
        },
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <h2>
          Index - INDEX INITIAL
        </h2>
      </div>"
    `);

    dfd.resolve("INDEX UPDATED");
    await waitFor(() => screen.getByText(/INDEX UPDATED/));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home - HYDRATED ROOT
        </h1>
        <h2>
          Index - INDEX UPDATED
        </h2>
      </div>"
    `);
  });

  it("supports partial hydration w/lazy initial routes (leaf fallback)", async () => {
    let dfd = createDeferred();
    let router = createTestRouter(
      [
        {
          path: "/",
          Component() {
            return (
              <>
                <h1>Root</h1>
                <Outlet />
              </>
            );
          },
          children: [
            {
              id: "index",
              index: true,
              HydrateFallback: () => <p>Index Loading...</p>,
              async lazy() {
                await tick();
                return {
                  loader: () => dfd.promise,
                  Component() {
                    let data = useLoaderData() as string;
                    return <h2>{`Index - ${data}`}</h2>;
                  },
                };
              },
            },
          ],
        },
      ],
      {
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Root
        </h1>
        <p>
          Index Loading...
        </p>
      </div>"
    `);

    dfd.resolve("INDEX DATA");
    await waitFor(() => screen.getByText(/INDEX DATA/));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Root
        </h1>
        <h2>
          Index - INDEX DATA
        </h2>
      </div>"
    `);
  });

  it("supports partial hydration w/lazy initial routes (root fallback)", async () => {
    let dfd = createDeferred();
    let router = createTestRouter(
      [
        {
          path: "/",
          Component() {
            return (
              <>
                <h1>Root</h1>
                <Outlet />
              </>
            );
          },
          HydrateFallback: () => <p>Loading...</p>,
          children: [
            {
              id: "index",
              index: true,
              async lazy() {
                await tick();
                return {
                  loader: () => dfd.promise,
                  Component() {
                    let data = useLoaderData() as string;
                    return <h2>{`Index - ${data}`}</h2>;
                  },
                };
              },
            },
          ],
        },
      ],
      {
        future: {
          v7_partialHydration: true,
        },
      }
    );
    let { container } = render(<RouterProvider router={router} />);

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <p>
          Loading...
        </p>
      </div>"
    `);

    dfd.resolve("INDEX DATA");
    await waitFor(() => screen.getByText(/INDEX DATA/));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Root
        </h1>
        <h2>
          Index - INDEX DATA
        </h2>
      </div>"
    `);
  });
}
