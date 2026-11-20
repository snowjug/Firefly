// The one place the Studio (the Trainer and the mentor Calibration pages) meets the parts of the app
// that other work owns: the page frame and its primitives, the dialog, the Signal instrument and the
// field behind the app. Everything the Studio needs from them comes through here, so a change to
// any of them is a change to one file.

export {
  ChoiceRow,
  Disclosure,
  EmptyNotice,
  ErrorNotice,
  Field,
  Ledger,
  LoadingNotice,
  PageFrame,
  PageHead,
  SelectInput,
  Stat,
  StatRow,
  Tag,
  TextArea,
  TextInput,
  Toggle,
  type ChoiceOption,
  type TagTone,
} from '../frame/index.ts';
export { slidePip } from '../frame/motion.ts';
export { Dialog } from '../Dialog.tsx';
export { Icon } from '../Icon.tsx';
export { SignalGlyph } from '../signal/SignalGlyph.tsx';
export type { GlyphTraits } from '../signal/types.ts';
export { useWorldPose } from '../world/useWorldPose.ts';
