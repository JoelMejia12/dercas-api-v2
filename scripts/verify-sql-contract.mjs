import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = join(root, 'src');
const officialSqlPath = join(root, 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function matches(text, expression, group = 1) {
  return [...text.matchAll(expression)].map((match) => match[group]);
}

const sourcePaths = sourceFiles(sourceRoot);
const source = sourcePaths.map((path) => readFileSync(path, 'utf8')).join('\n');
const officialSql = readFileSync(officialSqlPath, 'utf8');
const declarations = new Set(matches(
  officialSql,
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|MATERIALIZED\s+VIEW|TYPE|FUNCTION|PROCEDURE|SEQUENCE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:gacor\.)?([a-z][a-z0-9_]*)/gi,
).map((name) => name.toLowerCase()));
const referencedObjects = new Set(matches(source, /\bgacor\.([a-z][a-z0-9_]*)\b/gi).map((name) => name.toLowerCase()));
const missingObjects = [...referencedObjects].filter((name) => !declarations.has(name)).sort();

const declaredEnums = new Set(matches(
  officialSql,
  /CREATE\s+TYPE\s+(?:gacor\.)?([a-z][a-z0-9_]*_enum)\s+AS\s+ENUM/gi,
).map((name) => name.toLowerCase()));
const referencedEnums = new Set(matches(source, /\bgacor\.([a-z][a-z0-9_]*_enum)\b/gi).map((name) => name.toLowerCase()));
const missingEnums = [...referencedEnums].filter((name) => !declaredEnums.has(name)).sort();

if (missingObjects.length || missingEnums.length) {
  if (missingObjects.length) process.stderr.write(`SQL objects referenced in src but absent from official DDL: ${missingObjects.join(', ')}\n`);
  if (missingEnums.length) process.stderr.write(`Enums referenced in src but absent from official DDL: ${missingEnums.join(', ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`SQL source contract verified: ${referencedObjects.size} schema-qualified object names and ${referencedEnums.size} enum casts match ${relative(root, officialSqlPath)}.\n`);
}
