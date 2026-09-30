
- Estados / Fase

| Estado      | Fase          | UI  | Información                                                          |
| ----------- | ------------- | --- | -------------------------------------------------------------------- |
| Disponible  | Espera        | 🟢   | Unidad posicionada en su punto de cobertura.                         |
| Asignada    | Activación    | 🟡   | Se ha transmitido por radio un aviso prioritario.                    |
| En camino   | Aproximación  | 🔵   | Unidad movilizada.                                                   |
| En el lugar | Intervención  | 🔴   | Unidad en asistencia sanitaria.                                      |
| En traslado | Evacuación    | 💠   | Traslado de paciente.                                                |
| En destino  | Transferencia | 🟠   | Transferencia en el destino objetivo.                                |
| Operativa   | Retorno       | 🟢   | Unidad regresando a su punto de cobertura asignado por el recorrido. |
| Inoperativa | Bloqueo       | ⚫   | Unidad inmovilizada.                                                 |

---

- Modulo de información, vista global (sin nada seleccionado):

| Modulo de información   |
| ----------------------- |
| 🟢 8 Libres              |
| 🔴 2 Interviniendo       |
| 💠 1 En traslado         |
| ⚫ 1 Inoperativa         |
| ----------------------- |

Solo muestra contador de flota los que tengan al menos 1 dotación segun estado/fase:

---

- En el de Módulo de elementos se verán todos los elementos creados (y se podrán seleccionar desde ahi tambien).

| Módulo de elementos           |
| ----------------------------- |
| **Dotaciones:**               |
| 🚑 Tango 1                     |
| 🚑 Tango 2                     |
| 🚑 Tango 3                     |
| 🚁 Charlie 3                   |
| 🚗Papa 4                       |
| [toggle]                      |
| **Generales:**                |
| 🏥 H. Vithas                   |
| 🚴🏽‍♂️ Cabeza de carrera           |
| 🏃🏽‍♂️ Cola carrera                |
| 📍 Avituallamiento             |
| ⚠ OJO CUIDAO                  |
| ⚕ PSA                         |
|                               |
|                               |
| [⚙]                           |
| ----------------------------- |

[⚙] - Botón para configurar elementos (añadir, quitar, duplicar y modificar)
[toggle 🟢🟡🔵🔴💠🟠🟢⚫] Filtro visual para mostrar/ ocultar segun estado/fase

---

- Reloj

```
______________________________________________
|·Digital·Watch·|·UTC+2[ST]·|·UTC+1[WT]·|·ESP·|
|     _____    _____       _____    _____     |
|    |     |  |     |  O  |     |  |     |    |
|    |_____|  |_____|  O  |_____|  |_____|    |
|         Zulu Time [00:00]                   |
| [+] T-Zero [+] T-Minus [+] Advisories         |
| --------------------------------------------- |
|                                               |
| [HH:MM:SS][▶][⏸][⏹]                     (❌)   |
| [ej. T-Zero]_________________________________ |
|                                               |
|                                               |
|                                               |
|                                               |
|                                               |
|                                               |
| [HH:MM:SS][▶][⏸][⏹]                     (❌)   |
| [ej. T-Minus]________________________________ |
|                                               |
|                                               |
| [HH:MM:SS][▶][⏹]                        (❌)   |
| [ej. Advisories]_____________________________ |
|                                               |
|                                               |
| _____________________________________________ |
```

[+] T-Zero (añade cronometros, que se pueda agregar una notita)
▶iniciar ⏸pausar ⏹ reiniciar (a cero)❌cerrar

[HH:MM:SS][▶][⏸][⏹]         (❌)
[textarea]_____________________

[+] T-Minus (añade cuentas regresivas, que se pueda agregar una notita) usara un timbre al llegar a 0, que optimizaré para que ocupe muy poco y podamos subir a netlify, despues se descargará al instalar.
Agrega el tiempo para la cuenta regresiva [00:00:00] en el time area del reloj y una notita [textarea]
▶iniciar ⏸pausar ⏹ reiniciar (con el tiempo inicial)❌cerrar

|[HH:MM:SS][▶][⏸][⏹]        (❌)
|[textarea]_____________________

[+] Advisories (Agrega el tiempo para el recordatorio [00:00:00] en el time area del reloj y una notita) usara un timbre al llegar a 0, que optimizaré para que ocupe muy poco y podamos subir a netlify, despues se descargará al instalar.
▶iniciar ⏹ Desactivar recordatorio (con el tiempo inicial)❌cerrar

|[HH:MM:SS][▶][⏹]             (❌)
|[textarea]______________________

- Cuaderno

 Un block para tomar notas, que podamos añadir tanto una nota,  o checklist, etiqueta, etc...

_____________________________________
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
|                                   |
_____________________________________
