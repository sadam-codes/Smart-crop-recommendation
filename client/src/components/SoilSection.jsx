import { useRef } from 'react'
import { FaCamera, FaLeaf, FaPenToSquare } from 'react-icons/fa6'

const BOUNDS_N = '0–140'
const BOUNDS_P = '5–145'
const BOUNDS_K = '5–205'
const BOUNDS_PH = '3.5–10'

const baseInput =
  'min-h-11 w-full rounded-xl border bg-[#fcfaf7] px-3 py-2.5 text-sm font-medium text-slate-800 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const inputOk = 'border-[#eee] focus:border-[#4B7922] focus:ring-[#4B7922]/20'
const inputErr = 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-200'

const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-stone-500'

function FieldHint({ id, error }) {
  if (!error) return null
  return (
    <p id={id} className="text-xs font-medium text-red-600" role="alert">
      {error}
    </p>
  )
}

/**
 * @param {object} props
 * @param {Record<'N'|'P'|'K'|'ph', string | null | undefined>} [props.errors]
 */
export default function SoilSection({
  N,
  P,
  K,
  ph,
  onChange,
  errors = {},
  onReportImage,
  scanning = false,
  scanError = null,
  scanPreviewUrl = null,
  soilScanAvailable = true,
}) {
  const fileRef = useRef(null)
  const eN = errors.N ?? null
  const eP = errors.P ?? null
  const eK = errors.K ?? null
  const ePh = errors.ph ?? null

  const cn = (err) => `${baseInput} ${err ? inputErr : inputOk}`

  function onFileChange(ev) {
    const file = ev.target.files?.[0]
    if (file && onReportImage) onReportImage(file)
    ev.target.value = ''
  }

  return (
    <section className="rounded-3xl border border-[#eee] bg-white p-5 shadow-[0_4px_6px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="mb-5 flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D9E4C5] text-[#4B7922]">
          <FaLeaf className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Soil data</h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Upload your soil report photo or type values from your lab test
          </p>
        </div>
      </div>

      <div className="mb-5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onFileChange}
          disabled={scanning || !soilScanAvailable}
          aria-hidden={!soilScanAvailable}
        />
        <button
          type="button"
          disabled={scanning || !soilScanAvailable}
          onClick={() => fileRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#c5d9a8] bg-[#f7faf0] px-4 py-6 text-center transition hover:border-[#4B7922] hover:bg-[#eef4e4] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:text-left"
        >
          {scanPreviewUrl ? (
            <img
              src={scanPreviewUrl}
              alt="Uploaded soil report"
              className="h-20 w-20 shrink-0 rounded-xl border border-[#D9E4C5] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#D9E4C5] text-[#4B7922]">
              {scanning ? (
                <span
                  className="h-7 w-7 animate-spin rounded-full border-2 border-[#4B7922]/25 border-t-[#4B7922]"
                  aria-hidden
                />
              ) : (
                <FaCamera className="h-7 w-7" aria-hidden />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#2d4714]">
              {scanning ? 'Reading your soil report…' : 'Upload soil report photo'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              {soilScanAvailable
                ? 'We will fill Nitrogen, Phosphorus, Potassium and pH automatically from the picture.'
                : 'Photo scan needs GROQ_API_KEY in server/.env — you can still type values below.'}
            </p>
          </div>
        </button>
        {scanError ? (
          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
            {scanError}
          </p>
        ) : null}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#eee]" aria-hidden />
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          <FaPenToSquare className="h-3.5 w-3.5" aria-hidden />
          Or enter manually
        </span>
        <div className="h-px flex-1 bg-[#eee]" aria-hidden />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Nitrogen (N) · {BOUNDS_N}</span>
          <input
            className={cn(eN)}
            value={N}
            onChange={(ev) => onChange('N', ev.target.value)}
            type="number"
            step="any"
            inputMode="decimal"
            placeholder=""
            aria-invalid={Boolean(eN)}
            aria-describedby={eN ? 'err-soil-N' : undefined}
          />
          <FieldHint id="err-soil-N" error={eN} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Phosphorus (P) · {BOUNDS_P}</span>
          <input
            className={cn(eP)}
            value={P}
            onChange={(ev) => onChange('P', ev.target.value)}
            type="number"
            step="any"
            inputMode="decimal"
            placeholder=""
            aria-invalid={Boolean(eP)}
            aria-describedby={eP ? 'err-soil-P' : undefined}
          />
          <FieldHint id="err-soil-P" error={eP} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Potassium (K) · {BOUNDS_K}</span>
          <input
            className={cn(eK)}
            value={K}
            onChange={(ev) => onChange('K', ev.target.value)}
            type="number"
            step="any"
            inputMode="decimal"
            placeholder=""
            aria-invalid={Boolean(eK)}
            aria-describedby={eK ? 'err-soil-K' : undefined}
          />
          <FieldHint id="err-soil-K" error={eK} />
        </label>
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className={labelClass}>pH level · {BOUNDS_PH}</span>
        <input
          className={cn(ePh)}
          value={ph}
          onChange={(ev) => onChange('ph', ev.target.value)}
          type="number"
          step="any"
          min={3.5}
          max={10}
          inputMode="decimal"
          placeholder=""
          aria-invalid={Boolean(ePh)}
          aria-describedby={ePh ? 'err-soil-ph' : undefined}
        />
        <FieldHint id="err-soil-ph" error={ePh} />
        <span className="text-xs text-stone-500">Soil acidity — not humidity (%).</span>
      </label>
    </section>
  )
}
