import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  DOMAINS,
  FILE_NAME,
  RECORDS,
  ROWS,
  csvLine,
  domainFor,
  findRow,
  rowsOf,
  type Domain,
  type RecordRow,
  type Row,
} from "@/data/codes";

const STEPS = [
  { id: "export", title: "File", detail: "One file arrives" },
  { id: "split", title: "Split", detail: "One list per type" },
  { id: "load", title: "Words", detail: "Words go into a lookup table" },
  { id: "store", title: "Number", detail: "The record keeps the number" },
  { id: "read", title: "Lookup", detail: "The words come back" },
] as const;

const ROW_MS = 1200;

const DEFAULT_TYPE = "EMPLOYMENT_STATUS_CODE";
const DEFAULT_CODE = "3";
const DEFAULT_RECORD = "1042";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function quote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function insertSql(domain: Domain, rows: Row[]) {
  if (rows.length === 0) {
    return [
      `-- ${domain.refTable} is empty`,
      `-- Add the words from ${domain.mapFile}.`,
      `INSERT INTO ${domain.refTable} (`,
      `  code, description, effective_from, effective_to`,
      `) VALUES`,
      `  -- waiting on the mapping file`,
      `;`,
    ].join("\n");
  }
  const values = rows
    .map(
      (row) =>
        `  (${row.code}, ${quote(row.description)}, DATE '${row.effectiveFrom}', DATE '${row.effectiveTo}')`,
    )
    .join(",\n");
  return [
    `INSERT INTO ${domain.refTable} (`,
    `  code, description, effective_from, effective_to`,
    `)`,
    `VALUES`,
    `${values};`,
  ].join("\n");
}

function createPersonSql() {
  const cols = [
    "  person_id                     varchar(16) PRIMARY KEY",
    ...DOMAINS.map((domain) => `  ${domain.column.padEnd(28)}smallint NOT NULL`),
  ];
  return `CREATE TABLE person (\n${cols.join(",\n")}\n);`;
}

function joinSql(record: RecordRow) {
  const selectList = DOMAINS.map(
    (domain) => `  ${domain.alias}.description AS ${domain.selectAs}`,
  ).join(",\n");
  const joins = DOMAINS.map(
    (domain) =>
      [
        `LEFT JOIN ${domain.refTable} AS ${domain.alias}`,
        `  ON ${domain.alias}.code = p.${domain.column}`,
        ` AND CURRENT_DATE BETWEEN ${domain.alias}.effective_from AND ${domain.alias}.effective_to`,
      ].join("\n"),
  ).join("\n");
  return [
    `SELECT`,
    `  p.person_id,`,
    selectList,
    `FROM person AS p`,
    joins,
    `WHERE p.person_id = ${quote(record.id)};`,
  ].join("\n");
}

function describe(record: RecordRow, domain: Domain) {
  return findRow(domain.codeType, record[domain.column])?.description ?? "—";
}

export function Studio() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [traceType, setTraceType] = useState(DEFAULT_TYPE);
  const [traceCode, setTraceCode] = useState(DEFAULT_CODE);
  const [recordId, setRecordId] = useState(DEFAULT_RECORD);
  const [loadedCounts, setLoadedCounts] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [resolved, setResolved] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const trace = findRow(traceType, traceCode) ?? ROWS[0];
  const domain = domainFor(trace.codeType);
  const record = RECORDS.find((item) => item.id === recordId) ?? RECORDS[0];
  const loaded = loadedCounts[domain.codeType] ?? 0;
  const domainRows = rowsOf(domain.codeType);

  function selectTrace(codeType: string, code: string) {
    const nextRows = rowsOf(codeType);
    const nextCode = nextRows.some((row) => row.code === code) ? code : nextRows[0].code;
    setTraceType(codeType);
    setTraceCode(nextCode);
  }

  function reset() {
    setPlaying(false);
    setRunning(false);
    setStep(0);
    setTraceType(DEFAULT_TYPE);
    setTraceCode(DEFAULT_CODE);
    setRecordId(DEFAULT_RECORD);
    setLoadedCounts({});
    setResolved(false);
  }

  function goTo(next: number) {
    setPlaying(false);
    setStep(next);
  }

  useEffect(() => {
    if (!running) return;
    const total = rowsOf(traceType).length;
    if (reduced) {
      setLoadedCounts((prev) => ({ ...prev, [traceType]: total }));
      setRunning(false);
      return;
    }
    const id = window.setInterval(() => {
      setLoadedCounts((prev) => {
        const count = prev[traceType] ?? 0;
        if (count >= total) return prev;
        return { ...prev, [traceType]: count + 1 };
      });
    }, ROW_MS);
    return () => window.clearInterval(id);
  }, [running, traceType, reduced]);

  useEffect(() => {
    if (!running) return;
    const total = rowsOf(traceType).length;
    if ((loadedCounts[traceType] ?? 0) >= total) setRunning(false);
  }, [running, traceType, loadedCounts]);

  useEffect(() => {
    if (!playing) return;
    if (step === 2) setRunning(true);
    if (step === 4) setResolved(true);
  }, [playing, step]);

  useEffect(() => {
    if (!playing) return;
    const total = rowsOf(traceType).length;
    const count = loadedCounts[traceType] ?? 0;
    if (step === 2 && count < total) return;
    const wait = reduced ? 600 : step === 2 ? 2400 : step === 4 ? 6500 : 5200;
    const id = window.setTimeout(() => {
      if (step >= STEPS.length - 1) setPlaying(false);
      else setStep((current) => current + 1);
    }, wait);
    return () => window.clearTimeout(id);
  }, [playing, step, loadedCounts, traceType, reduced]);

  useEffect(() => {
    const strip = stripRef.current;
    const current = strip?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!strip || !current) return;
    const target = current.offsetLeft - 12;
    strip.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" });
  }, [step, reduced]);

  const stations = [
    { title: "File", value: `${trace.code} · ${trace.description}` },
    { title: "Split", value: domain.mapFile },
    {
      title: "Words",
      value: loaded > 0 ? `${loaded} of ${domainRows.length} added` : "not added yet",
    },
    { title: "Number", value: `keeps ${trace.code}` },
    { title: "Lookup", value: trace.description },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <p className="font-mono text-sm text-muted">Codepath</p>
        <h1 className="mt-2 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          From a number to its words
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
          One file comes out. It is split into lists. The database keeps the number. The list
          supplies the words.
        </p>
        <p className="mt-5 max-w-2xl border-l-4 border-l-copper bg-copper-soft px-4 py-3 text-base leading-relaxed">
          You set up dates and permitted values in the metadata repository. The result is a code
          list. This page follows that code list to data engineering, then shows how it links to
          the data you see on your screens.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block min-w-0 sm:max-w-xl sm:flex-1">
          <span className="font-mono text-sm text-muted">Follow one code</span>
          <select
            className="mt-1 min-h-11 w-full border border-line bg-paper-2 px-3 font-mono text-sm"
            value={`${traceType}|${traceCode}`}
            onChange={(event) => {
              const [codeType, code] = event.target.value.split("|");
              selectTrace(codeType, code);
            }}
          >
            {DOMAINS.map((item) => (
              <optgroup key={item.codeType} label={item.label}>
                {rowsOf(item.codeType).map((row) => (
                  <option key={`${item.codeType}-${row.code}`} value={`${item.codeType}|${row.code}`}>
                    {row.code} — {row.description}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center bg-ink px-4 font-mono text-sm text-paper"
            onClick={() => setPlaying((value) => !value)}
            aria-pressed={playing}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center border border-line bg-paper-2 px-4 font-mono text-sm"
            onClick={reset}
          >
            Restart
          </button>
        </div>
      </div>

      <div
        ref={stripRef}
        className="relative mt-5 flex min-w-0 gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible"
      >
        {stations.map((station, index) => {
          const current = index === step;
          return (
            <button
              key={station.title}
              type="button"
              data-step={index}
              aria-current={current ? "step" : undefined}
              onClick={() => goTo(index)}
              className={
                "w-56 shrink-0 border px-3 py-3 text-left lg:w-auto " +
                (current
                  ? "border-line border-t-4 border-t-copper bg-copper-soft"
                  : "border-line bg-paper-2")
              }
            >
              <span className="font-mono text-xs text-muted">
                {index + 1} {station.title}
              </span>
              <span className="mt-1 line-clamp-2 block font-mono text-sm leading-snug">
                {station.value}
              </span>
            </button>
          );
        })}
      </div>

      <div className="stage-in mt-6" key={step} aria-live="polite">
        {step === 0 ? <ExportStage trace={trace} /> : null}
        {step === 1 ? (
          <SplitStage
            domain={domain}
            trace={trace}
            onSelect={(codeType) => selectTrace(codeType, trace.code)}
          />
        ) : null}
        {step === 2 ? (
          <LoadStage
            domain={domain}
            trace={trace}
            loaded={loaded}
            running={running}
            onInsert={() => {
              if ((loadedCounts[domain.codeType] ?? 0) >= domainRows.length) {
                setLoadedCounts((prev) => ({ ...prev, [domain.codeType]: 0 }));
              }
              setRunning(true);
            }}
          />
        ) : null}
        {step === 3 ? (
          <StoreStage
            domain={domain}
            trace={trace}
            recordId={record.id}
            onSelectRecord={setRecordId}
          />
        ) : null}
        {step === 4 ? (
          <ReadStage
            domain={domain}
            record={record}
            resolved={resolved}
            onResolve={() => setResolved(true)}
            onSelectRecord={setRecordId}
          />
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex min-h-11 items-center border border-line bg-paper-2 px-4 font-mono text-sm disabled:opacity-40"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
        >
          Back
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center bg-ink px-4 font-mono text-sm text-paper"
          onClick={() => {
            if (step >= STEPS.length - 1) reset();
            else goTo(step + 1);
          }}
        >
          {step >= STEPS.length - 1 ? "Start again" : `Next · ${STEPS[step + 1].title}`}
        </button>
      </div>

      <p className="mt-10 max-w-2xl font-mono text-xs leading-relaxed text-muted">
        {ROWS.length} lines in one file, split into {DOMAINS.length} lists. The sample records
        (Record 1042 and so on) are made-up examples, not real people.
      </p>
    </main>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-3 text-lg leading-snug">
      <span className="mt-2 size-2.5 shrink-0 bg-copper" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Sheet({
  kind,
  title,
  meta,
  children,
}: {
  kind: string;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden border border-line bg-paper-2">
      <header className="flex items-start justify-between gap-3 bg-ink px-4 py-3 text-paper">
        <div className="min-w-0">
          <p className="font-mono text-xs text-db-muted">{kind}</p>
          <h3 className="truncate font-mono text-sm">{title}</h3>
        </div>
        {meta ? <p className="shrink-0 font-mono text-xs text-db-muted">{meta}</p> : null}
      </header>
      {children}
    </section>
  );
}

function SqlBlock({
  children,
  className = "",
  sqlRef,
}: {
  children: string;
  className?: string;
  sqlRef?: Ref<HTMLPreElement>;
}) {
  return (
    <>
      <p className="mb-1 font-mono text-xs text-muted">
        The code behind this step, for the curious. You do not need to read it.
      </p>
      <pre
        ref={sqlRef}
        className={
          "overflow-auto bg-ink p-4 font-mono text-sm leading-relaxed text-paper " + className
        }
      >
        {children}
      </pre>
    </>
  );
}

const COLUMN_JOBS = [
  { term: "CODE_TYPE", def: "Which list this line belongs to, such as gender or employment." },
  { term: "CODE", def: "The number that gets saved." },
  { term: "DESCRIPTION", def: "The words for that number." },
  { term: "FROM / TO", def: "The dates you set. 1600 and 9999 mean there is no start or end date: always." },
  { term: "MODIFIED", def: "When the line was last edited. It is not carried into the database." },
];

function ExportStage({ trace }: { trace: Row }) {
  const scroller = useRef<HTMLDivElement>(null);
  const marked = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const box = scroller.current;
    const row = marked.current;
    if (!box || !row) return;
    const boxRect = box.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < boxRect.top || rowRect.bottom > boxRect.bottom) {
      box.scrollTop += rowRect.top - boxRect.top - boxRect.height / 2 + rowRect.height / 2;
    }
  }, [trace.codeType, trace.code]);

  return (
    <section>
      <Point>This is your code list: one file with every type of code mixed in together.</Point>
      <p className="mt-4 overflow-x-auto font-mono text-sm text-ink-soft">{csvLine(trace)}</p>
      <p className="mt-1 mb-4 font-mono text-xs text-muted">The line we are following. Each line is one permitted value: a number, its words, and the dates it applies.</p>
      <Sheet kind="The export" title={FILE_NAME} meta={`${ROWS.length} lines`}>
        <div ref={scroller} className="max-h-96 overflow-auto">
          <table className="w-full min-w-max border-collapse text-left font-mono text-sm">
            <thead className="sticky top-0 bg-paper-2">
              <tr className="border-b border-line text-ink-soft">
                <th className="w-1 p-0" />
                <th className="px-3 py-2 font-medium" scope="col">
                  CODE_TYPE
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  CODE
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  DESCRIPTION
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  FROM
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  TO
                </th>
                <th className="hidden px-3 py-2 font-medium md:table-cell" scope="col">
                  MODIFIED
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const hot = row.codeType === trace.codeType && row.code === trace.code;
                return (
                  <tr
                    key={`${row.codeType}-${row.code}`}
                    ref={hot ? marked : undefined}
                    className={hot ? "bg-ink text-paper" : "border-b border-line"}
                  >
                    <td className={hot ? "w-1 bg-copper p-0" : "w-1 p-0"} />
                    <td className="px-3 py-2 whitespace-nowrap">{row.codeType}</td>
                    <td className="px-3 py-2">{row.code}</td>
                    <td className="max-w-xs px-3 py-2 whitespace-normal">{row.description}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.effectiveFrom}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.effectiveTo}</td>
                    <td className="hidden px-3 py-2 whitespace-nowrap md:table-cell">
                      {row.modified}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sheet>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {COLUMN_JOBS.map((job) => (
          <div key={job.term} className="border-t border-line pt-3">
            <dt className="font-mono text-sm">{job.term}</dt>
            <dd className="mt-1 text-base leading-relaxed text-ink-soft">{job.def}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SplitStage({
  domain,
  trace,
  onSelect,
}: {
  domain: Domain;
  trace: Row;
  onSelect: (codeType: string) => void;
}) {
  return (
    <section>
      <Point>Data engineering cuts the file by type. Each type becomes its own small mapping file: a number, and its words.</Point>
      <p className="mt-4 mb-4 font-mono text-sm text-ink-soft">
        1 file → {DOMAINS.length} lists
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DOMAINS.map((item) => {
          const on = item.codeType === domain.codeType;
          const count = rowsOf(item.codeType).length;
          return (
            <li key={item.codeType}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(item.codeType)}
                className={
                  "min-h-11 w-full border px-3 py-3 text-left " +
                  (on ? "border-ink bg-ink text-paper" : "border-line bg-paper-2")
                }
              >
                <span className={"font-mono text-xs " + (on ? "text-db-muted" : "text-muted")}>
                  {count} codes
                </span>
                <span className="mt-1 block font-mono text-sm break-all">{item.mapFile}</span>
                <span className="mt-1 block text-base">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <Sheet
          kind="Mapping file"
          title={domain.mapFile}
          meta={`${rowsOf(domain.codeType).length} lines`}
        >
          <div className="max-h-80 overflow-auto">
            <table className="w-full border-collapse text-left font-mono text-sm">
              <thead className="sticky top-0 bg-paper-2 text-ink-soft">
                <tr className="border-b border-line">
                  <th className="w-1 p-0" />
                  <th className="px-3 py-2 font-medium" scope="col">
                    CODE
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    DESCRIPTION
                  </th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell" scope="col">
                    EFFECTIVE
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowsOf(domain.codeType).map((row) => {
                  const hot = row.code === trace.code;
                  return (
                    <tr key={row.code} className={hot ? "bg-ink text-paper" : "border-b border-line"}>
                      <td className={hot ? "w-1 bg-copper p-0" : "w-1 p-0"} />
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2 whitespace-normal">{row.description}</td>
                      <td className="hidden px-3 py-2 whitespace-nowrap sm:table-cell">
                        {row.effectiveFrom} → {row.effectiveTo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Sheet>
      </div>
      {domain.caution ? (
        <p className="mt-4 border-l-4 border-l-copper bg-copper-soft px-4 py-3 leading-relaxed">
          {domain.caution}
        </p>
      ) : (
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          Tip: choose State or territory to see one name that needed tidying.
        </p>
      )}
    </section>
  );
}

function LoadStage({
  domain,
  trace,
  loaded,
  running,
  onInsert,
}: {
  domain: Domain;
  trace: Row;
  loaded: number;
  running: boolean;
  onInsert: () => void;
}) {
  const all = rowsOf(domain.codeType);
  const visible = all.slice(0, loaded);
  const done = loaded >= all.length;
  const justAdded = visible[visible.length - 1];
  const listBox = useRef<HTMLDivElement>(null);
  const tableBox = useRef<HTMLDivElement>(null);
  const listRow = useRef<HTMLTableRowElement>(null);
  const tableRow = useRef<HTMLTableRowElement>(null);
  const sqlBox = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pairs: [HTMLDivElement | null, HTMLTableRowElement | null][] = [
      [listBox.current, listRow.current],
      [tableBox.current, tableRow.current],
    ];
    for (const [box, row] of pairs) {
      if (!box || !row) continue;
      const boxRect = box.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      if (rowRect.top < boxRect.top || rowRect.bottom > boxRect.bottom) {
        box.scrollTo({
          top: box.scrollTop + rowRect.top - boxRect.top - boxRect.height / 3,
          behavior: "smooth",
        });
      }
    }
    const sql = sqlBox.current;
    if (sql) sql.scrollTo({ top: sql.scrollHeight, behavior: "smooth" });
  }, [loaded]);

  return (
    <section>
      <Point>Engineering adds the words from the mapping file to a lookup table: a small reference list the database keeps. No person records are touched yet.</Point>
      <div className="mt-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-sm text-ink">
          {loaded} of {all.length}
          {running ? " · watch each line" : ""}
        </p>
        <button
          type="button"
          className="inline-flex min-h-11 items-center bg-ink px-4 font-mono text-sm text-paper disabled:opacity-50"
          onClick={onInsert}
          disabled={running}
        >
          {done ? "Play it again" : loaded > 0 ? "Keep going" : "Add the words"}
        </button>
      </div>
      <div className="mb-4 min-h-[4.25rem] border-l-4 border-l-copper bg-copper-soft px-4 py-3 font-mono text-2xl leading-tight">
        {justAdded ? (
          <span key={justAdded.code} className="slide-right block">
            {justAdded.code} {justAdded.description}
          </span>
        ) : (
          <span className="text-base text-muted">Press “Add the words” to watch them arrive.</span>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Sheet kind="Mapping file" title={domain.mapFile} meta="the list">
          <div ref={listBox} className="h-72 overflow-auto">
            <table className="w-full border-collapse text-left font-mono text-sm">
              <thead className="sticky top-0 bg-paper-2 text-ink-soft">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium" scope="col">
                    CODE
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    DESCRIPTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {all.map((row, index) => {
                  const moved = index < loaded;
                  const fresh = index === loaded - 1;
                  const hot = row.code === trace.code;
                  return (
                    <tr
                      key={row.code}
                      ref={fresh ? listRow : undefined}
                      className={
                        "transition-colors duration-500 " +
                        (fresh
                          ? "bg-copper-soft"
                          : hot
                            ? "bg-ink text-paper"
                            : moved
                              ? "border-b border-line text-muted"
                              : "border-b border-line")
                      }
                    >
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2 whitespace-normal">{row.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Sheet>
        <Sheet kind="Lookup table" title={domain.refTable} meta={done ? "ready" : loaded > 0 ? "filling up" : "empty until loaded"}>
          <div ref={tableBox} className="h-72 overflow-auto">
            <table className="w-full border-collapse text-left font-mono text-sm">
              <thead className="sticky top-0 bg-paper-2 text-ink-soft">
                <tr className="border-b border-line">
                  <th className="w-1 p-0" />
                  <th className="px-3 py-2 font-medium" scope="col">
                    code
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    description
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => {
                  const fresh = index === visible.length - 1;
                  const marked = fresh || (done && row.code === trace.code);
                  return (
                    <tr
                      key={row.code}
                      ref={fresh ? tableRow : undefined}
                      className={
                        "row-slide transition-colors duration-500 " +
                        (marked ? "bg-ink text-paper" : "border-b border-line")
                      }
                    >
                      <td className={marked ? "w-1 bg-copper p-0" : "w-1 p-0"} />
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2 whitespace-normal">
                        <span className="slide-right slide-right-late inline-block">
                          {row.description}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <p className="px-4 py-6 text-base leading-relaxed text-ink-soft">
                Empty. The words are still only in the list.
              </p>
            ) : null}
          </div>
        </Sheet>
      </div>
      <div className="mt-3">
        <SqlBlock sqlRef={sqlBox} className="h-64">{insertSql(domain, visible)}</SqlBlock>
      </div>
      <p className="mt-3 text-base text-ink-soft">
        The dates you set come with the words. 1600 to 9999 means always. The last-edited time stays behind in the file.
      </p>
    </section>
  );
}

function StoreStage({
  domain,
  trace,
  recordId,
  onSelectRecord,
}: {
  domain: Domain;
  trace: Row;
  recordId: string;
  onSelectRecord: (id: string) => void;
}) {
  return (
    <section>
      <Point>A person's record keeps only the number, not the words. If the wording changes, it is changed once, in the list.</Point>
      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        <div className="border border-line bg-paper-2 p-4 lg:col-span-2">
          <p className="font-mono text-xs text-muted">Stored</p>
          <p className="mt-3 font-mono text-sm break-all">{domain.column}</p>
          <p className="mt-2 font-mono text-5xl leading-none">{trace.code}</p>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            “{trace.description}” is not saved on the record.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3">
          <div className="border border-line p-4">
            <h3 className="font-mono text-sm">Words on every row</h3>
            <p className="mt-2 leading-relaxed text-ink-soft">
              A new wording for “{trace.description}” means editing every record that stores {trace.code}.
            </p>
          </div>
          <div className="border border-ink bg-ink p-4 text-paper">
            <h3 className="font-mono text-sm">Number on the row</h3>
            <p className="mt-2 leading-relaxed text-db-muted">
              Update {domain.mapFile} once. The record still stores {trace.code}.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <SqlBlock>{createPersonSql()}</SqlBlock>
      </div>
      <RecordPicker recordId={recordId} onSelectRecord={onSelectRecord} />
      <div className="mt-3">
        <PersonTable recordId={recordId} active={domain} />
      </div>
      <p className="mt-3 text-base text-ink-soft">
        Some teams also copy the words onto the record for convenience. The number is still the real value.
      </p>
    </section>
  );
}

function Wipe({
  text,
  delay,
  className,
}: {
  text: string;
  delay: number;
  className?: string;
}) {
  return (
    <span className={className ? `wipe-in ${className}` : "wipe-in"} style={{ animationDelay: `${delay}ms` }}>
      {text}
    </span>
  );
}

const WORD_GAP = 1500;

function ReadStage({
  domain,
  record,
  resolved,
  onResolve,
  onSelectRecord,
}: {
  domain: Domain;
  record: RecordRow;
  resolved: boolean;
  onResolve: () => void;
  onSelectRecord: (id: string) => void;
}) {
  const sentence = DOMAINS.map((item) => describe(record, item)).join("; ");
  const [sentenceOn, setSentenceOn] = useState(false);

  useEffect(() => {
    if (!resolved) {
      setSentenceOn(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSentenceOn(true);
      return;
    }
    setSentenceOn(false);
    const id = window.setTimeout(
      () => setSentenceOn(true),
      1600 + DOMAINS.length * WORD_GAP,
    );
    return () => window.clearTimeout(id);
  }, [resolved, record.id]);

  return (
    <section>
      <Point>The screens you use match the stored number to the lookup. That match brings the words back.</Point>
      <RecordPicker recordId={record.id} onSelectRecord={onSelectRecord} />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="border border-line bg-paper-2 p-4">
          <p className="font-mono text-xs text-muted">On record {record.id}</p>
          <p className="mt-3 font-mono text-sm break-all">{domain.column}</p>
          <p className="mt-2 font-mono text-5xl leading-none">{record[domain.column]}</p>
        </div>
        <div className={"border p-4 " + (resolved ? "border-ink bg-ink text-paper" : "border-line bg-paper-2")}>
          <p className={"font-mono text-xs " + (resolved ? "text-db-muted" : "text-muted")}>
            {resolved ? "From the lookup" : "Words hidden"}
          </p>
          <p className="mt-3 text-3xl leading-tight font-semibold break-words">
            {resolved ? (
              <Wipe
                key={`${record.id}-hero`}
                text={describe(record, domain)}
                delay={0}
                className="wipe-slow block"
              />
            ) : (
              "—"
            )}
          </p>
          {!resolved ? (
            <button
              type="button"
              className="mt-4 inline-flex min-h-11 items-center bg-ink px-4 font-mono text-sm text-paper"
              onClick={onResolve}
            >
              Show the words
            </button>
          ) : (
            <p className="mt-3 font-mono text-sm text-db-muted">
              <Wipe key={`${record.id}-via`} text={`via ${domain.mapFile}`} delay={700} />
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <PersonReadTable record={record} active={domain} resolved={resolved} />
      </div>
      {sentenceOn ? (
        <p className="mt-4 text-lg leading-relaxed">
          <Wipe
            key={`${record.id}-sentence`}
            text={`Record ${record.id} reads as: ${sentence}.`}
            delay={0}
            className="wipe-slow"
          />
        </p>
      ) : null}
      <div className="mt-3">
        <SqlBlock>{joinSql(record)}</SqlBlock>
      </div>
      <p className="mt-3 text-base text-ink-soft">
        Behind the scenes this match is called a join, here to {domain.refTable}. An end date of
        9999 means the words are still current.
      </p>
      <p className="mt-3 border-l-4 border-l-copper bg-copper-soft px-4 py-3 text-base leading-relaxed">
        So the database holds numbers, and the words you see come from your code list. The dates
        and permitted values you set decide which words appear.
      </p>
    </section>
  );
}

function RecordPicker({
  recordId,
  onSelectRecord,
}: {
  recordId: string;
  onSelectRecord: (id: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Illustrative records">
      {RECORDS.map((item) => {
        const on = item.id === recordId;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelectRecord(item.id)}
            className={
              "inline-flex min-h-11 items-center px-3 font-mono text-sm " +
              (on ? "bg-ink text-paper" : "border border-line bg-paper-2")
            }
          >
            Record {item.id}
          </button>
        );
      })}
    </div>
  );
}

function PersonTable({ recordId, active }: { recordId: string; active: Domain }) {
  return (
    <Sheet kind="In the database" title="person" meta="numbers only">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left font-mono text-sm">
          <thead className="bg-paper-2 text-ink-soft">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium" scope="col">
                person_id
              </th>
              {DOMAINS.map((item) => (
                <th key={item.column} className="px-3 py-2 font-medium whitespace-nowrap" scope="col">
                  {item.column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECORDS.map((item) => {
              const on = item.id === recordId;
              return (
                <tr key={item.id} className={on ? "bg-ink text-paper" : "border-b border-line"}>
                  <td className="px-3 py-2">{item.id}</td>
                  {DOMAINS.map((domain) => {
                    const hot = on && domain.column === active.column;
                    return (
                      <td key={domain.column} className="px-3 py-2">
                        <span className={hot ? "border-b-2 border-b-copper" : undefined}>
                          {item[domain.column]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}

function PersonReadTable({
  record,
  active,
  resolved,
}: {
  record: RecordRow;
  active: Domain;
  resolved: boolean;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!resolved) {
      setShown(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(DOMAINS.length);
      return;
    }
    setShown(0);
    const timers = DOMAINS.map((_, index) =>
      window.setTimeout(() => setShown(index + 1), 1600 + index * WORD_GAP),
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [resolved, record.id]);

  return (
    <Sheet kind={resolved ? "Words filled in" : "Before the lookup"} title={`record ${record.id}`} meta="one row">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="bg-paper-2 font-mono text-ink-soft">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium" scope="col">
                Field
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Code stored
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Description
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Mapping file
              </th>
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((item, index) => {
              const hot = item.column === active.column;
              const arrived = shown > index;
              const arriving = shown === index + 1;
              return (
                <tr
                  key={`${record.id}-${item.column}`}
                  className={
                    hot
                      ? "bg-ink text-paper"
                      : "border-b border-line" + (arriving ? " row-arrive" : "")
                  }
                >
                  <td className="px-3 py-2 font-mono text-sm whitespace-nowrap">{item.selectAs}</td>
                  <td className="px-3 py-2 font-mono">{record[item.column]}</td>
                  <td className="px-3 py-2">
                    {arrived ? (
                      <Wipe
                        key={`${record.id}-${item.column}`}
                        text={describe(record, item)}
                        delay={0}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={"px-3 py-2 font-mono text-sm " + (hot ? "text-db-muted" : "text-muted")}>
                    {item.mapFile}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}
