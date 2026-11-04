import path from 'node:path'
import Ajv from 'ajv'
import { digest } from './snapshot.mjs'

export const analysisLabels = {
  inventory: 'Inventario de la app', styles: 'Estilos y medidas', consistency: 'Coherencia visual',
  unused: 'Código sin uso', architecture: 'Arquitectura', dependencies: 'Dependencias',
  assets: 'Recursos públicos', bundle: 'Empaquetado', pipeline: 'Ejecución del diagnóstico',
}
const analysisOrder = Object.keys(analysisLabels)
export const diagnosticVersion = 1
export const findingSchema = {
  type: 'object', additionalProperties: false,
  required: ['id','analyzer','origins','rule','nature','title','element','observed','facts','classification','confidence','impact','scope','evidence','files','relatedIds','fingerprint'],
  properties: {
    id: { type:'string', pattern:'^[a-f0-9]{20}$' }, analyzer:{type:'string'}, origins:{type:'array',items:{type:'string'},minItems:1},
    rule:{type:'string'}, nature:{type:'string'}, title:{type:'string'}, observed:{type:'string'}, scope:{type:'string'},
    element:{type:'object',required:['kind','name'],properties:{kind:{type:'string'},name:{type:'string'},file:{type:'string'}}},
    facts:{type:'object'}, classification:{enum:['observación','inconsistencia','relación','dato','limitación']}, confidence:{enum:['alta','media','baja']},
    impact:{type:'object',additionalProperties:false,required:['certainty','description'],properties:{certainty:{enum:['comprobado','posible','no acreditado']},description:{type:'string'}}},
    evidence:{type:'array',items:{type:'object',properties:{file:{type:'string'},line:{type:'integer',minimum:1},detail:{type:'string'}}}},
    files:{type:'array',items:{type:'string'}},relatedIds:{type:'array',items:{type:'string'}},fingerprint:{type:'string'},
    alsoReportedAs:{type:'array',items:{type:'object',required:['analyzer','id'],properties:{analyzer:{type:'string'},id:{type:'string'}}}},
  },
}
const validateList = new Ajv({allErrors:true}).compile({type:'array',items:findingSchema})
export function validateFindings(findings) {
  if (!validateList(findings)) throw new Error(`Hallazgo inválido: ${validateList.errors[0].instancePath} ${validateList.errors[0].message}`)
  if (new Set(findings.map(item=>item.id)).size!==findings.length) throw new Error('Identificador de hallazgo duplicado.')
}
export const markdownText = value => String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', ' ')
export const markdownTable = (headers, rows) => rows.length ? [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(markdownText).join(' | ')} |`)].join('\n') : 'Sin registros en este apartado.'
export const markdownDocument = (title, ...sections) => [`# ${title}`, ...sections.filter(Boolean), ''].join('\n\n')
export function sourceReference(file, line = 1, sourceRoot = '../../../') {
  if (!file) return 'ejecución'
  const label = `${file}:${line ?? 1}`.replaceAll('[', '\\[').replaceAll(']', '\\]')
  return `[${label}](${(sourceRoot + file).split('/').map(part => encodeURIComponent(part)).join('/')}#L${line ?? 1})`
}
export const entryReference = (item, sourceRoot) => sourceReference(typeof item.source === 'string' ? item.source : item.file, item.line, sourceRoot)
export const readableBytes = value => value < 1000 ? `${value} B` : value < 1_000_000 ? `${(value / 1000).toFixed(2)} kB` : `${(value / 1_000_000).toFixed(2)} MB`
const group = (items, keyOf) => {
  const groups = new Map()
  for (const item of items) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}

const scopes = {
  inventory: 'Inventario estático de fuentes, registros y componentes candidatos. No representa instancias montadas ni datos de UIBoards.',
  styles: 'Declaraciones y configuraciones estáticas a zoom 1. No calcula la cascada completa ni mide contenido, fuentes cargadas o tamaños efectivos.',
  consistency: 'Solo compara superficies y propiedades seleccionadas por la política. Las coincidencias de literales o tokens no prueban equivalencia semántica ni de zoom.',
  unused: 'Recorrido estático desde entradas conocidas, incluidos tipos y cargas literales. No cubre todos los usos dinámicos, reflexión o convenciones de carga; conectividad no equivale a ejecución.',
  architecture: 'Imports locales entre archivos de código de src, incluidos tipos y archivos sin recorrido. Un ciclo declarado no acredita un fallo de inicialización.',
  dependencies: 'Manifiesto, lock, instalación y consumidores reconocidos; npm comprueba el árbol local offline. No mide código emitido ni consulta actualizaciones o vulnerabilidades.',
  assets: 'Archivos de public/, referencias y configuración explícita. No mide tráfico ni carga real. La configuración PWA declarada no acredita precaché emitida.',
  bundle: 'Tamaños reales del build y gzip; atribución a fuentes aproximada. No mide RAM, tiempos de arranque ni todas las descargas reales.',
  pipeline: 'Estado de la ejecución y estabilidad de las entradas; no evalúa el funcionamiento de la app.',
}
const definitions = {
  'detached-group': ['Componentes y archivos sin consumidores conectados', 'observación', 'no acreditado', 'No se acredita un fallo funcional por la ausencia de recorrido detectado. El grupo puede estar reservado o utilizar una carga no reconocida.'],
  'unreferenced-exports': ['Declaraciones sin referencias locales ni externas conectadas', 'observación', 'no acreditado', 'La ausencia de referencias reconocidas describe el uso del código dentro del alcance analizado; no acredita un fallo funcional.'],
  'internal-exports': ['Exportaciones con uso exclusivamente interno', 'observación', 'no acreditado', 'La declaración conserva usos dentro de su archivo. Su exportación sin consumidores externos no acredita un fallo ni un coste de ejecución.'],
  'local-unused': ['Diagnósticos de nombres sin uso', 'inconsistencia', 'posible', 'El diagnóstico de TypeScript puede impedir superar la comprobación de tipos si se trata como error en la configuración vigente.'],
  'unused-css': ['Clases locales sin referencias reconocidas', 'observación', 'no acreditado', 'No se acredita una alteración visual. La clase puede tener un consumo fuera del alcance reconocido.'],
  'runtime-cycle': ['Ciclos de imports de valores', 'observación', 'posible', 'El acceso durante una inicialización circular puede encontrar valores todavía no inicializados. El recorrido declarado no demuestra que eso ocurra.'],
  'type-related-cycle': ['Ciclos al incluir tipos', 'relación', 'no acreditado', 'Los imports de tipos se borran al compilar. Este grupo no acredita por sí solo un fallo de inicialización; los ciclos de valores se identifican por separado.'],
  'deferred-cycle': ['Ciclos con cargas diferidas', 'observación', 'posible', 'El comportamiento puede depender del orden de carga e inicialización. El grafo no observa ese orden en ejecución.'],
  'cross-feature-contract': ['Relaciones entre funcionalidades', 'relación', 'no acreditado', 'La relación no incumple por sí misma una regla de capas ni acredita un fallo. No hay un umbral de acoplamiento acordado.'],
  'undeclared-use': ['Usos directos sin declaración propia', 'inconsistencia', 'posible', 'El recurso importado puede dejar de resolverse si cambia o desaparece la instalación transitiva que lo proporciona.'],
  'review-consumers': ['Situación de los consumidores de paquetes', 'observación', 'no acreditado', 'La ausencia de import propio o de consumidores conectados no acredita un fallo. Un requisito transitivo o peer puede justificar la declaración.'],
  'installed-multiple-versions': ['Versiones presentes en la instalación', 'dato', 'no acreditado', 'La coexistencia instalada no acredita incompatibilidad ni peso adicional del bundle. Los rangos de consumidores pueden exigir esas versiones.'],
  'installed-lock-version': ['Desajustes entre manifiesto, lock e instalación', 'inconsistencia', 'posible', 'El entorno instalado puede diferir del reproducido por el lock y producir resultados distintos de compilación o carga.'],
  'installed-without-lock-node': ['Desajustes entre manifiesto, lock e instalación', 'inconsistencia', 'posible', 'La instalación contiene una ubicación sin respaldo en el lock; otro entorno puede no reproducirla.'],
  'manifest-lock-declaration': ['Desajustes entre manifiesto, lock e instalación', 'inconsistencia', 'posible', 'Manifiesto y lock describen requisitos diferentes; una instalación reproducible puede fallar o utilizar otro árbol.'],
  'lock-only-declaration': ['Desajustes entre manifiesto, lock e instalación', 'inconsistencia', 'posible', 'El lock contiene una declaración que no coincide con el manifiesto actual; ambos describen árboles distintos.'],
  'npm-tree-problem': ['Problemas del árbol instalado informados por npm', 'inconsistencia', 'posible', 'El incumplimiento de requisitos que informa npm puede afectar a compilación o carga, según el paquete. No acredita un fallo observado en la interfaz.'],
  'missing-public-file': ['Referencias sin archivo público local', 'inconsistencia', 'posible', 'Si la URL se sirve tal como está declarada y el recurso no se genera por otra vía, su carga puede fallar.'],
  'public-path-case': ['Diferencias de mayúsculas en rutas públicas', 'inconsistencia', 'posible', 'La referencia puede fallar en un servidor sensible a mayúsculas aunque funcione en otro sistema.'],
  'duplicate-public-content': ['Archivos públicos con contenido idéntico', 'dato', 'comprobado', 'Existen varias copias locales de los mismos bytes. No se acredita que todas se descarguen ni que sus rutas y licencias sean intercambiables.'],
  'public-without-declared-reference': ['Recursos sin referencia reconocida', 'observación', 'no acreditado', 'No se acredita un fallo ni ausencia de uso: pueden existir rutas dinámicas o consumidores externos al alcance leído.'],
  'unmatched-include-assets': ['Patrones includeAssets sin coincidencias', 'observación', 'no acreditado', 'El patrón no aporta archivos públicos reconocidos. Puede ser una reserva intencional; no demuestra un recurso ausente en ejecución.'],
  'style-difference': ['Diferencias entre superficies comparables', 'observación', 'posible', 'Las superficies pueden mostrar valores distintos si estas declaraciones se aplican en su contexto. No se calcula el efecto final de la cascada.'],
  'exception-mismatch': ['Excepciones visuales con valor distinto del esperado', 'inconsistencia', 'posible', 'La declaración puede apartarse de una especialización visual documentada. Su efecto visible depende de la composición y la cascada.'],
  'repeated-literal': ['Coincidencias de propiedades y valores literales', 'observación', 'no acreditado', 'Compartir un valor literal no acredita incoherencia ni fallo visual; las declaraciones pueden tener responsabilidades distintas.'],
  'token-candidates': ['Coincidencias con tokens existentes', 'observación', 'no acreditado', 'La coincidencia con un token no acredita un contrato compartido ni un problema visual actual.'],
  'numeric-constraint': ['Restricciones numéricas contradictorias', 'inconsistencia', 'posible', 'Las restricciones pueden producir un tamaño distinto al inicial o al máximo esperado. No se ha medido recorte ni layout efectivo.'],
  'multiple-versions': ['Versiones presentes en el código emitido', 'dato', 'posible', 'El artefacto incluye código de varias versiones. Los bytes emitidos pueden contribuir a transferencia y almacenamiento cuando se carguen; no son ahorro recuperable acreditado.'],
  'coverage-gap': ['Limitaciones de cobertura', 'limitación', 'posible', 'El análisis de esta zona puede omitir consumidores o relaciones y producir conclusiones incompletas. No implica un fallo de la app.'],
  'stage-failure': ['Fallos de ejecución del análisis', 'limitación', 'comprobado', 'La etapa no produjo resultados utilizables; sus conclusiones no están disponibles.'],
  'input-drift': ['Cambios de entradas durante el análisis', 'limitación', 'comprobado', 'Los resultados pueden corresponder a estados distintos del código y la comparación de esta ejecución no es fiable.'],
}

export function elementFromFile(file = '') {
  const parts = file.split('/')
  if (parts[0] === 'src' && parts[1] === 'components' && parts[2] === 'ui' && parts[3]) return { kind: 'Componente UI', name: parts[3], file }
  if (parts[0] === 'src' && parts[1] === 'features') return { kind: `Archivo del área ${parts[2]}`, name: path.posix.basename(file), file }
  if (parts[0] === 'src' && parts[1] === 'domain') return { kind: `Contrato de dominio: ${parts[2]}`, name: path.posix.basename(file), file }
  return { kind: 'Archivo', name: file || 'Ejecución del análisis', ...(file ? { file } : {}) }
}
export function finding(analyzer, rule, key, title, evidence, options = {}) {
  const [nature, classification, certainty, description] = definitions[rule] ?? ['Observaciones del análisis', 'observación', 'no acreditado', 'La evidencia disponible no acredita una consecuencia funcional.']
  const { confidence = 'media', signature = key, element = elementFromFile(evidence.find(item => item.file)?.file), observed = title, facts = {} } = options
  return { id: digest(`${analyzer}:${rule}:${key}`).slice(0,20), analyzer, origins: [analyzer], rule, nature, title,
    element, observed, facts, classification, confidence, impact: { certainty, description }, scope: scopes[analyzer] ?? scopes.pipeline,
    evidence, files: [...new Set(evidence.map(item=>item.file).filter(Boolean))].sort(), relatedIds: [], fingerprint: digest(JSON.stringify(signature)) }
}

function detachedGroups(unused) {
  const byFile = new Map(unused.detachedFiles.map(item=>[item.file,item]))
  const neighbors = new Map([...byFile.keys()].map(file=>[file,new Set()]))
  for (const edge of unused.graph) if (byFile.has(edge.from) && byFile.has(edge.to)) { neighbors.get(edge.from).add(edge.to); neighbors.get(edge.to).add(edge.from) }
  const visited = new Set(), groups = []
  for (const file of [...byFile.keys()].sort()) {
    if (visited.has(file)) continue
    const queue = [file], members = []
    while (queue.length) { const next=queue.pop(); if (visited.has(next)) continue; visited.add(next); members.push(next); queue.push(...neighbors.get(next)) }
    members.sort(); groups.push(members.map(name=>byFile.get(name)))
  }
  return groups
}
const useEvidence = use => ({ file: use.file, line: use.line, detail: `${use.kind}: ${use.specifier}; ámbito: ${use.scope}.` })
const requirementEvidence = item => ({ file: `${item.from}/package.json`, line: 1, detail: `${item.kind}: ${item.name} ${item.range}; opcional: ${item.optional}; resolución: ${item.target ?? 'sin resolución'}; versión: ${item.version ?? 'sin reconocer'}.` })
const fileLocation = item => ({ file: item.file ?? item.source, line: item.line ?? 1 })

export function collectFindings(reports) {
  const result = [], add = (...args) => result.push(finding(...args)), unused = reports.unused
  if (unused) {
    for (const members of detachedGroups(unused)) {
      const names = members.map(item=>item.file), inside = new Set(names)
      const incoming = members.flatMap(item=>item.consumers), outside = incoming.filter(edge=>!inside.has(edge.from))
      const element = elementFromFile(names[0]), totalBytes = members.reduce((sum,item)=>sum+item.bytes,0)
      add('unused','detached-group',names.join('|'),`${element.kind}: ${element.name} — sin consumidores conectados`,
        members.map(item=>({ file:item.file,line:1,detail:`${item.bytes} bytes de fuente; ${item.consumers.length} consumidores directos: ${item.consumers.map(edge=>`${edge.from}:${edge.line} (${edge.kind})`).join('; ') || 'ninguno'}.` })), {
          element, observed:`${members.length} archivos relacionados sin recorrido reconocido desde las entradas; ${outside.length} referencias desde fuera de la familia, todas sin conexión reconocida desde las entradas.`,
          facts:{ files:names, sourceBytes:totalBytes, internalReferences:incoming.length-outside.length, disconnectedExternalReferences:outside.length, connectedExternalReferences:0 }, signature:names,
        })
    }
    for (const [key, entries] of group(unused.unusedExports,item=>`${item.file}:${item.localReferences>0?'internal':'unreferenced'}`)) {
      const internal=entries[0].localReferences>0, names=entries.map(item=>item.name).sort(), element=elementFromFile(entries[0].file)
      add('unused',internal?'internal-exports':'unreferenced-exports',key,`${element.kind}: ${element.name} — ${internal?'exportaciones con uso interno':'declaraciones sin consumidores conectados'}`,
        entries.map(item=>({file:item.file,line:item.line,detail:`${item.name} (${item.declarationKind}); referencias locales: ${item.localReferences}; externas desconectadas: ${item.disconnectedReferences}; externas conectadas: 0.`,symbol:item.name})), {
          element, observed:`${names.length} declaraciones: ${names.join(', ')}. ${internal?'Conservan uso local.':'Sin referencias locales detectadas.'} No se reconocen consumidores externos conectados.`,
          facts:{ declarations:entries.map(({name,localReferences,disconnectedReferences})=>({name,localReferences,disconnectedReferences,connectedExternalReferences:0})) }, signature:names,
        })
    }
    for (const item of unused.localUnused) add('unused','local-unused',`${item.file}:${item.code}:${item.message}`,`TypeScript TS${item.code}: ${item.message}`,[{...fileLocation(item),detail:item.message}],{confidence:'alta',facts:{code:item.code}})
    for (const [file,entries] of group(unused.unusedClasses,item=>item.file)) add('unused','unused-css',file,`Clases locales sin referencia: ${elementFromFile(file).name}`,entries.map(item=>({...fileLocation(item),detail:`${item.name}; selector: ${item.selector}; contexto: ${item.context.join(' → ')}.`,symbol:item.name})),{observed:`${entries.length} clases locales sin referencias reconocidas: ${entries.map(item=>item.name).join(', ')}.`,facts:{classes:entries.map(item=>item.name)},signature:entries.map(item=>item.name).sort()})
    for (const [key,entries] of group(unused.uncertainties,item=>`${item.file}:${item.kind}`)) add('unused','coverage-gap',key,entries[0].kind,entries.map(item=>({...fileLocation(item),detail:item.expression})),{confidence:'alta',signature:entries.map(item=>item.expression).sort()})
  }
  const architecture=reports.architecture
  if (architecture) {
    const signature=edges=>edges.map(edge=>`${edge.from}:${edge.to}:${edge.dependencyType}:${edge.kind}:${edge.specifier}:${edge.fromConnected}`).sort()
    const evidence=edges=>edges.map(edge=>({file:edge.from,line:edge.line,detail:`${edge.dependencyType}: ${edge.specifier} → ${edge.to}; origen ${edge.fromConnected?'con recorrido desde entradas':'sin recorrido desde entradas'}.`}))
    for (const [rule,items] of [['runtime-cycle',architecture.runtimeCycles],['type-related-cycle',architecture.typeRelatedCycles],['deferred-cycle',architecture.deferredCycles]]) for (const item of items) {
      const route=[...item.witness.map(edge=>edge.from),item.witness.at(-1)?.to]
      add('architecture',rule,item.members.join('|'),`${rule==='runtime-cycle'?'Ciclo de valores':rule==='type-related-cycle'?'Ciclo al incluir tipos':'Ciclo con import()'}: ${item.members.map(file=>path.posix.basename(file)).join(' → ')}`,evidence(item.edges),{
        confidence:'alta',element:{kind:'Grupo de archivos',name:item.members.map(file=>path.posix.basename(file)).join(', ')},
        observed:`${item.members.length} archivos; ${item.connectedFiles} con recorrido desde entradas. Ejemplo cerrado: ${route.join(' → ')}.`,
        facts:{members:item.members,route,counts:item.counts,connectedFiles:item.connectedFiles,onlyTypes:item.onlyTypes??false,containsRuntimeCycle:item.containsRuntimeCycle??false},signature:signature(item.edges),
      })
    }
    for (const item of architecture.crossFeatureRelations) add('architecture','cross-feature-contract',`${item.from}:${item.to}`,`${item.from} → ${item.to}`,evidence(item.edges),{
      confidence:'alta',element:{kind:'Relación entre áreas',name:`${item.from} → ${item.to}`},
      observed:`${item.edges.length} declaraciones entre ${item.importerFiles.length} archivos de origen y ${item.targetFiles.length} de destino; valores ${item.counts.runtime}, tipos ${item.counts.type}, diferidas ${item.counts.dynamic}, workers ${item.counts.worker}, URL/resolución ${item.counts.url+item.counts.resolution}.`,facts:{counts:item.counts,importerFiles:item.importerFiles,targetFiles:item.targetFiles},signature:signature(item.edges),
    })
    for (const item of architecture.uncertainties) add('architecture','coverage-gap',`${item.file}:${item.kind}:${item.expression}`,item.kind,[{...fileLocation(item),detail:item.expression}],{confidence:'alta',signature:item.expression})
  }
  const dependencies=reports.dependencies
  if (dependencies) {
    for (const item of dependencies.undeclaredUses) add('dependencies','undeclared-use',item.name,`Paquete: ${item.name} — uso sin declaración propia`,[...item.uses.map(useEvidence),...item.requiredBy.map(requirementEvidence)],{
      confidence:'alta',element:{kind:'Paquete',name:item.name},observed:`${item.uses.length} referencias directas del proyecto; instalado ${item.installedVersion??'no reconocido'}; sin declaración propia. Tipos de uso: ${[...new Set(item.uses.map(use=>use.kind))].join(', ')}.`,
      facts:{installedVersion:item.installedVersion,uses:item.uses,requiredBy:item.requiredBy},signature:{uses:item.uses.map(use=>`${use.file}:${use.specifier}:${use.kind}:${use.scope}`).sort(),installed:item.installedVersion},
    })
    for (const item of dependencies.reviewCandidates) add('dependencies','review-consumers',item.name,`Paquete: ${item.name} — ${item.status}`,[{file:'package.json',line:1,detail:`${item.status}; declaraciones: ${item.declarations.map(entry=>`${entry.section}: ${entry.range}`).join('; ')}.`},...item.uses.map(useEvidence),...item.requiredBy.map(requirementEvidence)],{
      confidence:'baja',element:{kind:'Paquete',name:item.name},observed:`${item.status}; ${item.uses.length} referencias del proyecto; ${item.requiredBy.length} requisitos de paquetes instalados.`,facts:{status:item.status,declarations:item.declarations,uses:item.uses,requiredBy:item.requiredBy},
      signature:{status:item.status,declarations:item.declarations,uses:item.uses.map(use=>`${use.file}:${use.specifier}:${use.kind}`).sort(),requiredBy:item.requiredBy.map(entry=>`${entry.from}:${entry.kind}:${entry.range}:${entry.optional}`).sort()},
    })
    for (const item of dependencies.issues) add('dependencies',item.rule,`${item.name}:${item.file}:${item.section??''}`,`Paquete: ${item.name} — ${item.rule}`,[{file:item.file,line:1,detail:item.detail}],{confidence:'alta',element:{kind:'Paquete',name:item.name},signature:item.detail})
    for (const problem of dependencies.npm.problems) add('dependencies','npm-tree-problem',problem,`Árbol instalado: ${problem}`,[{file:'package-lock.json',line:1,detail:problem}],{confidence:'alta',signature:problem})
    for (const item of dependencies.multipleVersions) {
      const requiredBy=dependencies.requirements.filter(entry=>entry.name===item.name && entry.source==='instalado')
      add('dependencies','installed-multiple-versions',item.name,`Paquete: ${item.name} — varias versiones instaladas`,[...item.locations.map(entry=>({file:`${entry.path}/package.json`,line:1,detail:entry.version})),...requiredBy.map(requirementEvidence)],{
        confidence:'alta',element:{kind:'Paquete',name:item.name},observed:`Versiones instaladas: ${[...new Set(item.locations.map(entry=>entry.version))].join(', ')}; ${item.locations.length} ubicaciones.`,facts:{locations:item.locations,requiredBy},signature:item.locations,
      })
    }
    for (const item of dependencies.uncertainties) add('dependencies','coverage-gap',`${item.file}:${item.kind}:${item.expression}`,item.kind,[{...fileLocation(item),detail:item.expression}],{confidence:'alta',signature:item.expression})
  }
  const assets=reports.assets
  if (assets) {
    for (const [target,entries] of group(assets.missingReferences,item=>item.target)) add('assets','missing-public-file',target,`Recurso sin archivo local: ${target}`,entries.map(item=>({file:item.source,line:item.line,detail:`${item.kind}: ${item.value}`})),{confidence:'alta',element:{kind:'Recurso público',name:target},signature:entries.map(item=>`${item.source}:${item.kind}:${item.value}`).sort()})
    for (const [target,entries] of group(assets.caseMismatches,item=>item.target)) add('assets','public-path-case',target,`Mayúsculas distintas en recurso: ${target}`,entries.map(item=>({file:item.source,line:item.line,detail:`Declarado ${item.value}; existentes: ${item.actualFiles.join(', ')}.`})),{element:{kind:'Recurso público',name:target},signature:entries.map(item=>`${item.target}:${item.actualFiles.join('|')}`).sort()})
    for (const item of assets.duplicates) add('assets','duplicate-public-content',item.files.slice().sort().join('|'),`Contenido idéntico en ${item.files.length} archivos públicos`,item.files.map(file=>({file,line:1,detail:`${item.bytesPerFile} bytes; SHA-256 ${item.hash}.`})),{confidence:'alta',element:{kind:'Grupo de recursos',name:item.files.join(', ')},observed:`${item.files.length} archivos con contenido idéntico: ${item.bytesPerFile} bytes por copia y ${item.bytesPerFile*item.files.length} bytes de fuente en total.`,facts:{hash:item.hash,bytesPerFile:item.bytesPerFile,sourceBytes:item.bytesPerFile*item.files.length,includesLicenses:item.includesLicenses},signature:{hash:item.hash,files:item.files.slice().sort()}})
    for (const [folder,entries] of group(assets.unreferenced.filter(item=>!item.license),item=>item.file.slice(0,item.file.lastIndexOf('/')))) add('assets','public-without-declared-reference',folder,`Recursos sin referencia reconocida: ${folder}`,entries.map(item=>({file:item.file,line:1,detail:`${item.bytes} bytes; sin referencia ni coincidencia de configuración reconocida.`})),{confidence:'baja',element:{kind:'Carpeta de recursos',name:folder},signature:entries.map(item=>item.file).sort()})
    for (const item of assets.unmatchedIncludePatterns) add('assets','unmatched-include-assets',item.pattern,`includeAssets sin coincidencias: ${item.pattern}`,[{file:item.source,line:item.line,detail:item.pattern}],{confidence:'baja',signature:item.pattern})
    for (const item of assets.uncertainties) add('assets','coverage-gap',`${item.file}:${item.kind}:${item.expression}`,item.kind,[{...fileLocation(item),detail:item.expression}],{confidence:'alta',signature:item.expression})
  }
  const ui=reports.consistency
  if (ui) {
    for (const item of ui.differences) add('consistency','style-difference',`${item.groupId??item.group}:${item.property}`,`${item.group}: valores distintos de ${item.property}`,item.variants.flatMap(variant=>variant.surfaces.map(surface=>({file:surface.source?.file??surface.file,line:surface.source?.line??surface.line,detail:`${surface.label}: ${variant.value}${surface.inherited?' (referencia heredada)':''}; componente ${surface.file}:${surface.line}.`}))),{
      confidence:'baja',element:{kind:'Grupo visual',name:item.group},observed:`${item.variants.length} valores de ${item.property}: ${item.variants.map(variant=>variant.value).join('; ')}; ${item.withoutDeclaration} superficies sin declaración comparable.`,facts:{property:item.property,withoutDeclaration:item.withoutDeclaration,variants:item.variants},signature:item.variants.map(variant=>({value:variant.value,labels:variant.surfaces.map(surface=>surface.label).sort()})),
    })
    for (const item of ui.exceptionViolations??[]) add('consistency','exception-mismatch',item.id,`${item.label}: ${item.property} distinto del esperado`,[{file:item.source?.file??item.file,line:item.source?.line??item.line,detail:`Esperado: ${item.expected}; declarado: ${item.actual}. ${item.reason}`}],{element:{kind:'Superficie visual',name:item.label},observed:`${item.property}: esperado ${item.expected}; declarado ${item.actual}.`,facts:{expected:item.expected,actual:item.actual,property:item.property},signature:{expected:item.expected,actual:item.actual}})
    for (const item of ui.uncertainties??[]) add('consistency','coverage-gap',`${item.kind}:${item.expression}`,item.kind,[{...fileLocation(item),detail:item.expression}],{confidence:'alta',signature:item.expression})
    for (const item of ui.repeatedLiterals) add('consistency','repeated-literal',`${item.property}:${item.value}`,`${item.property}: ${item.value} — coincidencia en ${item.files} hojas`,item.occurrences.map(entry=>({file:entry.file,line:entry.line,detail:`${item.property}: ${item.value}; selector ${entry.selector}; contexto: ${entry.context?.join(' → ')||'raíz'}.`})),{element:{kind:'Propiedad CSS',name:`${item.property}: ${item.value}`},observed:`${item.occurrences.length} declaraciones de ${item.property}: ${item.value} en ${item.files} hojas CSS.`,facts:{property:item.property,value:item.value,occurrences:item.occurrences.length,stylesheets:item.files},signature:item.occurrences.map(entry=>`${entry.file}:${entry.selector}`).sort()})
    for (const [file,entries] of group(ui.tokenCandidates,item=>item.file)) add('consistency','token-candidates',file,`${elementFromFile(file).name}: valores que coinciden con tokens`,entries.map(item=>({file:item.file,line:item.line,detail:`${item.selector}: ${item.property}: ${item.value}; coincidencias: ${item.matches.map(match=>`${match.literal} → ${match.tokens.map(token=>`${token.name} (${token.file}:${token.line}; ${token.value})`).join(', ')}`).join('; ')}.`})),{confidence:'baja',observed:`${entries.length} declaraciones de ${file} contienen valores literales coincidentes con tokens de su familia. Las coincidencias y fuentes se indican en la evidencia.`,facts:{declarations:entries.length},signature:entries.map(item=>`${item.selector}:${item.property}:${item.value}`).sort()})
    for (const item of ui.numericConstraints) add('consistency','numeric-constraint',`${item.file}:${item.label}:${item.axis}`,`${item.label}: restricción de ${item.axis}`,[{...fileLocation(item),detail:`${item.note} Inicial: ${item.initial??'sin dato'}; mínimo: ${item.minimum??'sin dato'}; máximo: ${item.maximum??'sin dato'}; contexto: ${item.context?.join(' → ')||'registro'}.`}],{element:{kind:'Restricción de tamaño',name:item.label},observed:`${item.axis}: inicial ${item.initial??'sin dato'}, mínimo ${item.minimum??'sin dato'}, máximo ${item.maximum??'sin dato'}. ${item.note}`,facts:{axis:item.axis,initial:item.initial,minimum:item.minimum,maximum:item.maximum},signature:item})
  }
  if (reports.bundle) for (const item of reports.bundle.multipleVersions) {
    const chunks=reports.bundle.chunks.filter(chunk=>chunk.sources.some(source=>source.package===item.package))
    add('bundle','multiple-versions',item.package,`Paquete emitido: ${item.package} — varias versiones`,chunks.map(chunk=>({artifact:chunk.file,detail:`${chunk.file}; carga ${chunk.initial?'inicial':chunk.worker?'worker':'diferida/compartida'}; ${chunk.bytes} bytes reales; versiones: ${[...new Set(chunk.sources.filter(source=>source.package===item.package).map(source=>source.version))].join(', ')}.`})),{
      element:{kind:'Paquete',name:item.package},observed:`Versiones emitidas: ${item.versions.join(', ')}; ${item.bytes} bytes atribuidos aproximadamente al paquete.`,facts:{versions:item.versions,attributedBytes:item.bytes,chunks:chunks.map(chunk=>chunk.file)},signature:item.versions.slice().sort(),
    })
  }
  for (const name of ['inventory','styles']) for (const item of reports[name]?.uncertainties??[]) add(name,'coverage-gap',`${item.file}:${item.kind}:${item.expression}`,item.kind,[{...fileLocation(item),detail:item.expression}],{confidence:'alta',signature:item.expression})
  return relateFindings(result)
}

export function relateFindings(items) {
  // Only exact duplicate coverage observations are merged. Distinct facts remain separate.
  const unique=[], gaps=new Map(), ids=new Map()
  for (const original of items) {
    const item={...original,origins:[...(original.origins??[original.analyzer])],relatedIds:[],alsoReportedAs:[...(original.alsoReportedAs??[])]}
    if (ids.has(item.id)) {
      const existing=ids.get(item.id)
      const evidence=[...new Map([...existing.evidence,...item.evidence].map(entry=>[JSON.stringify(entry),entry])).values()]
      if (JSON.stringify(existing.evidence)!==JSON.stringify(evidence) || JSON.stringify(existing.facts)!==JSON.stringify(item.facts)) {
        const instances=existing.facts.instances??[existing.facts]
        existing.facts={instances:[...new Map([...instances,item.facts].map(facts=>[JSON.stringify(facts),facts])).values()]}
        existing.evidence=evidence
        existing.files=[...new Set([...existing.files,...item.files])].sort()
        existing.observed=[...new Set([existing.observed,item.observed])].join(' ')
        existing.fingerprint=digest(JSON.stringify([existing.fingerprint,item.fingerprint].sort()))
      }
      existing.origins=[...new Set([...existing.origins,...item.origins])]
      continue
    }
    const key=item.rule==='coverage-gap'?JSON.stringify([item.title,item.evidence.map(entry=>[entry.file,entry.line,entry.detail]).sort()]):null
    if (key && gaps.has(key)) {
      const existing=gaps.get(key)
      existing.origins=[...new Set([...existing.origins,...item.origins])]
      existing.alsoReportedAs.push({analyzer:item.analyzer,id:item.id})
      ids.set(item.id,existing)
    } else { unique.push(item); ids.set(item.id,item); if(key) gaps.set(key,item) }
  }
  const link=(a,b)=>{if(!a.relatedIds.includes(b.id)) a.relatedIds.push(b.id);if(!b.relatedIds.includes(a.id)) b.relatedIds.push(a.id)}
  for (const [index,a] of unique.entries()) for (const b of unique.slice(index+1)) {
    const overlap=a.files.some(file=>b.files.includes(file))
    if ((a.rule==='detached-group' && b.rule==='review-consumers' && overlap) || (b.rule==='detached-group' && a.rule==='review-consumers' && overlap)) link(a,b)
    if (a.element.kind==='Paquete' && b.element.kind==='Paquete' && a.element.name===b.element.name && a.analyzer!==b.analyzer) link(a,b)
    if (overlap && ((a.rule==='detached-group' && b.analyzer==='consistency') || (b.rule==='detached-group' && a.analyzer==='consistency'))) link(a,b)
    if (overlap && a.analyzer==='architecture' && b.analyzer==='architecture' && a.rule!==b.rule && a.rule.endsWith('cycle') && b.rule.endsWith('cycle')) link(a,b)
  }
  return unique.sort((a,b)=>analysisOrder.indexOf(a.analyzer)-analysisOrder.indexOf(b.analyzer) || a.nature.localeCompare(b.nature,'es') || a.element.name.localeCompare(b.element.name,'es') || a.id.localeCompare(b.id,'en'))
}

export function diagnosticReport(analyzer, report) {
  if (!Object.hasOwn(analysisLabels,analyzer)) throw new Error(`Análisis desconocido: ${analyzer}`)
  const data={...report}
  const findings=collectFindings({[analyzer]:data})
  validateFindings(findings)
  return {...data,diagnosticSchemaVersion:diagnosticVersion,findings}
}

export function renderFindings(items, { analyses, sourceRoot='../../../', relatedReport } = {}) {
  const known=new Map(items.map(item=>[item.id,item]))
  const names=analyses??analysisOrder.filter(name=>items.some(item=>item.analyzer===name))
  const sections=[]
  for (const name of names) {
    const findings=items.filter(item=>item.analyzer===name)
    sections.push(`## Hallazgos · ${analysisLabels[name]??name} (${name})`)
    if (!findings.length) { sections.push('Sin hallazgos detectados por las reglas de este análisis. Los datos de referencia conservan su propio alcance.'); continue }
    for (const [nature,entries] of group(findings,item=>item.nature)) {
      sections.push(`### ${markdownText(nature)}`)
      for (const item of entries) {
        const anchors=[item.id,...(item.alsoReportedAs??[]).map(alias=>alias.id)].map(id=>`<a id="f-${id}"></a>`).join('\n\n')
        sections.push(`${anchors}\n\n#### ${markdownText(item.title)}`,
          markdownTable(['Dato','Resultado'],[
            ['Identificador',item.id],['Origen',item.origins.map(origin=>`${analysisLabels[origin]??origin} (${origin})`).join('; ')],
            ['Elemento',`${item.element.kind}: ${item.element.name}`],['Naturaleza / clasificación',`${item.nature} / ${item.classification}`],
            ['Dato detectado',item.observed],['Riesgo del hallazgo',`${item.impact.certainty}: ${item.impact.description}`],['Confianza en la evidencia',item.confidence],['Alcance',item.scope],
          ]),
          markdownTable(['Ubicación','Evidencia'],item.evidence.map(entry=>[entry.artifact??sourceReference(entry.file,entry.line,sourceRoot),entry.detail??entry.message??entry.expression??'Sin detalle adicional'])))
        if(item.relatedIds.length) sections.push(`**Hallazgos relacionados:** ${item.relatedIds.map(id=>known.has(id)?`[${known.get(id).element.name} · ${known.get(id).analyzer}](#f-${id})`:relatedReport?`[${id}](${relatedReport}#f-${id})`:id).join('; ')}.`)
        if(item.alsoReportedAs?.length) sections.push(`**Identificadores del mismo hallazgo en otros análisis:** ${item.alsoReportedAs.map(alias=>`${alias.analyzer}: ${alias.id}`).join('; ')}.`)
      }
    }
  }
  return sections.join('\n\n')
}

export function renderAnalysis(analyzer, report, referenceSections, { sourceRoot='../../../', relatedReport } = {}) {
  const findings=report.findings??collectFindings({[analyzer]:report})
  return markdownDocument(`${analysisLabels[analyzer]} de Angie`,
    `Generado: ${report.generatedAt}. Análisis: **${analysisLabels[analyzer]} (${analyzer})**. [Datos JSON completos](./report.json).`,
    scopes[analyzer], `${findings.length} hallazgos u observaciones. Cada registro distingue el dato detectado de su consecuencia; las decisiones de reparación quedan fuera del informe.`,
    renderFindings(findings,{analyses:[analyzer],sourceRoot,relatedReport}),...referenceSections)
}

export function bundleMetrics(report) {
  return report?{initialJavaScriptBytes:report.chunks.filter(item=>item.initial).reduce((sum,item)=>sum+item.bytes,0),totalJavaScriptBytes:report.chunks.reduce((sum,item)=>sum+item.bytes,0),precacheBytes:report.precache.bytes}:{}
}
