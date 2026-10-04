
- Estados / Fase

| Estado        | Fase          | Abrev | UI  | Información                                                    |
| ------------- | ------------- | ----- | --- | -------------------------------------------------------------- |
| Disponible    | Alerta        | DISP  | 🟢   | En su punto de cobertura, preparada para activación.           |
| Activada      | Alarma        | ACT   | 🟡   | Recurso activado ante un aviso prioritario.                    |
| Aproximandose | Aproximación  | RUTA  | 🔵   | En ruta al lugar del incidente.                                |
| Interviniendo | Asistencia    | ASIS  | 🔴   | Aislamiento y control, triaje, soporte vital y estabilización. |
| Trasladando   | Transporte    | TRAS  | 💠   | Paciente en traslado al centro sanitario de destino.           |
| Transfiriendo | Transferencia | ENTR  | 🟠   | Transferencia del paciente al equipo receptor.                 |
| Operativa     | Reactivación  | REAC  | 🟢   | Reactivación del recurso y retorno a su punto de cobertura.    |
| Inoperativa   | Bloqueo       | BLK   | ⚫   | Recurso temporalmente fuera de servicio.                       |

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
