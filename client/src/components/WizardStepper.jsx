import { FaCheck } from 'react-icons/fa6'

const steps = [
  { id: 1, label: 'Soil data' },
  { id: 2, label: 'Weather data' },
  { id: 3, label: 'Recommendation' },
]

const ring = 'ring-4 ring-[#4B7922]/25'

function StepCircle({ stepId, done, active }) {
  const circleClass = done
    ? 'bg-[#4B7922] text-white'
    : active
      ? `bg-[#4B7922] text-white ${ring}`
      : 'border-2 border-[#D9E4C5] bg-white text-slate-400'

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm transition sm:h-12 sm:w-12 sm:text-base ${circleClass}`}
    >
      {done ? <FaCheck className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden /> : stepId}
    </div>
  )
}

function StepLabel({ children, done, active }) {
  const labelClass = active ? 'text-[#4B7922]' : done ? 'text-[#2d4714]' : 'text-slate-400'
  return (
    <span className={`mt-2 block w-full px-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide sm:text-xs ${labelClass}`}>
      {children}
    </span>
  )
}

/**
 * Full-width stepper: steps spread across the row; checks reflect validated segments.
 */
export default function WizardStepper({ currentStep, soilComplete, weatherComplete }) {
  const step1Done = soilComplete
  const step2Done = weatherComplete
  const line12 = step1Done ? 'bg-[#4B7922]' : 'bg-[#D9E4C5]'
  const line23 = step2Done ? 'bg-[#4B7922]' : 'bg-[#D9E4C5]'

  return (
    <nav aria-label="Form steps" className="w-full">
      <div className="flex w-full max-w-none items-start">
        {/* Step 1 */}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <StepCircle stepId={1} done={step1Done} active={currentStep === 1} />
          <StepLabel done={step1Done} active={currentStep === 1}>
            {steps[0].label}
          </StepLabel>
        </div>

        {/* Connector */}
        <div className="flex min-w-[8px] max-w-[20%] flex-[1.25] items-center self-start pt-[1.375rem] sm:min-w-[1rem] sm:max-w-none" aria-hidden>
          <div className={`h-1.5 w-full rounded-full ${line12}`} />
        </div>

        {/* Step 2 */}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <StepCircle stepId={2} done={step2Done} active={currentStep === 2} />
          <StepLabel done={step2Done} active={currentStep === 2}>
            {steps[1].label}
          </StepLabel>
        </div>

        {/* Connector */}
        <div className="flex min-w-[8px] max-w-[20%] flex-[1.25] items-center self-start pt-[1.375rem] sm:min-w-[1rem] sm:max-w-none" aria-hidden>
          <div className={`h-1.5 w-full rounded-full ${line23}`} />
        </div>

        {/* Step 3 */}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <StepCircle stepId={3} done={false} active={currentStep === 3} />
          <StepLabel done={currentStep > 3} active={currentStep === 3}>
            {steps[2].label}
          </StepLabel>
        </div>
      </div>
    </nav>
  )
}
