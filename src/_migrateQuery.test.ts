/* eslint-disable no-console */
import { dataModelsForTests } from "@activeviam/data-model";
import { stringify } from "@activeviam/activeui-sdk";
import { LegacyQuery, _migrateQuery } from "./_migrateQuery";

const cube = dataModelsForTests.sandbox.catalogs[0].cubes[0];

describe("_migrateQuery", () => {
  it("warns if the updateMode is the legacy 'refresh-periodically'", () => {
    const legacyQuery: LegacyQuery = {
      mdx: "SELECT FROM [EquityDerivativesCube]",
      updateMode: "refresh-periodically",
    };
    const [migratedQuery, isUsingUnsupportedUpdateMode] = _migrateQuery({
      legacyQuery,
      cube,
    });
    expect(migratedQuery).toMatchInlineSnapshot(`
        Object {
          "filters": Array [],
          "query": Object {
            "mdx": Object {
              "axes": Array [],
              "cellProps": Array [],
              "elementType": "Select",
              "from": Object {
                "cubeName": "EquityDerivativesCube",
                "elementType": "From",
              },
              "slicerAxis": undefined,
              "withClause": Array [],
            },
            "updateMode": "once",
          },
          "queryContext": Array [],
        }
      `);
    expect(isUsingUnsupportedUpdateMode).toBe(true);
  });

  it("gracefully handles an empty MDX", () => {
    const [migratedQuery, isUsingUnsupportedUpdateMode] = _migrateQuery({
      legacyQuery: { mdx: "" },
      cube,
    });
    expect(migratedQuery).toEqual({
      query: { updateMode: "once" },
      queryContext: [],
      filters: [],
    });
    expect(isUsingUnsupportedUpdateMode).toBe(false);
  });

  it("strips filters from the MDX and returns them in the output", () => {
    const legacyQuery = {
      mdx: "SELECT FROM [EquityDerivativesCube] WHERE [Currency].[Currency].[AllMember].[EUR]",
    };
    const [{ query, filters }] = _migrateQuery({ legacyQuery, cube })!;
    expect(stringify(query.mdx!)).toBe("SELECT FROM [EquityDerivativesCube]");
    expect(filters.length).toBe(1);
    expect(stringify(filters[0])).toBe(
      "[Currency].[Currency].[AllMember].[EUR]",
    );
  });

  it("removes the useless (and dangerous) parts of the queries created when users collapse and re-expand a member in ActiveUI 4", () => {
    const legacyQuery = {
      mdx: `SELECT
        NON EMPTY Hierarchize(
          Union(
            Crossjoin(
              Hierarchize(
                DrilldownLevel(
                  [Currency].[Currency].[ALL].[AllMember]
                )
              ),
              Hierarchize(
                DrilldownLevel(
                  [Geography].[City].[ALL].[AllMember]
                )
              )
            ),
            Crossjoin(
              [Currency].[Currency].[ALL].[AllMember].[EUR],
              Descendants(
                {
                  [Geography].[City].[ALL].[AllMember]
                },
                [Geography].[City].[City]
              )
            )
          )
        ) ON ROWS
        FROM [EquityDerivativesCube]
        CELL PROPERTIES VALUE, FORMATTED_VALUE, BACK_COLOR, FORE_COLOR, FONT_FLAGS`,
    };

    const [
      {
        query: { mdx },
      },
    ] = _migrateQuery({ legacyQuery, cube })!;

    expect(stringify(mdx!, { indent: true })).toMatchInlineSnapshot(`
      "SELECT
        NON EMPTY Hierarchize(
          Crossjoin(
            Hierarchize(
              DrilldownLevel(
                [Currency].[Currency].[ALL].[AllMember]
              )
            ),
            Hierarchize(
              DrilldownLevel(
                [Geography].[City].[ALL].[AllMember]
              )
            )
          )
        ) ON ROWS
        FROM [EquityDerivativesCube]
        CELL PROPERTIES VALUE, FORMATTED_VALUE, BACK_COLOR, FORE_COLOR, FONT_FLAGS"
    `);
  });
});
