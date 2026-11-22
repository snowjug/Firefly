// Firefly's design system: tokens and base styles are loaded once with `./styles.ts`; each component
// loads its own stylesheet. Import primitives from here: `import { Button, Field } from '../design/index.ts'`.

export { cx } from './cx.ts';
export { Icon, ICON_NAMES, type IconName, type IconProps } from './icons.tsx';

export {
  Button,
  IconButton,
  LinkButton,
  OPENS_IN_NEW_TAB,
  ToggleButton,
  type ButtonAppearance,
  type ButtonLook,
  type ButtonProps,
  type ButtonSize,
  type IconButtonProps,
  type LinkButtonProps,
  type ToggleButtonProps,
} from './primitives/Button.tsx';
export { BackLink, Breadcrumb, TextLink } from './primitives/TextLink.tsx';
export type { BackLinkProps, BreadcrumbItem, TextLinkProps } from './primitives/TextLink.tsx';

export { Field, useControlWiring, type FieldProps } from './primitives/Field.tsx';
export {
  SearchBox,
  Select,
  TextArea,
  TextInput,
  type SearchBoxProps,
  type SelectProps,
  type TextAreaProps,
  type TextInputProps,
} from './primitives/TextInput.tsx';
export { Checkbox, Switch, type CheckboxProps, type SwitchProps } from './primitives/Choice.tsx';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from './primitives/SegmentedControl.tsx';

export {
  Badge,
  CUSTOMER_STATES,
  CUSTOMER_STATE_ICONS,
  CUSTOMER_STATE_LABELS,
  StateBadge,
  Tag,
  type BadgeProps,
  type BadgeTone,
  type CustomerState,
  type StateBadgeProps,
  type StatusTone,
  type TagProps,
} from './primitives/Badge.tsx';
export { MessageBar, type MessageBarProps, type MessageIntent } from './primitives/MessageBar.tsx';

export { Spinner, type SpinnerProps, type SpinnerSize } from './primitives/Spinner.tsx';
export { ProgressBar, type ProgressBarProps } from './primitives/ProgressBar.tsx';
export { ProgressShimmer, type ProgressShimmerProps } from './primitives/ProgressShimmer.tsx';
export { Skeleton, type SkeletonProps } from './primitives/Skeleton.tsx';
export { Avatar, initials, type AvatarProps, type AvatarSize } from './primitives/Avatar.tsx';
export { Card, Surface, type SurfaceProps, type SurfaceTag } from './primitives/Surface.tsx';
export { Divider, type DividerProps } from './primitives/Divider.tsx';
export { ScoreBar, type ScoreBarProps } from './primitives/ScoreBar.tsx';
export { ScoreRow, type ScoreRowProps } from './primitives/ScoreRow.tsx';
export { StatusBadge, type StatusBadgeProps } from './primitives/StatusBadge.tsx';
export { ProductIcon, type ProductIconProps } from './primitives/ProductIcon.tsx';

export { Disclosure, type DisclosureProps } from './primitives/Disclosure.tsx';
export { SplitView, type SplitViewProps } from './primitives/SplitView.tsx';
export {
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  type TabListProps,
  type TabPanelProps,
  type TabProps,
  type TabsProps,
} from './primitives/Tabs.tsx';
export { Dialog, type DialogCloseReason, type DialogProps } from './primitives/Dialog.tsx';

export {
  AnnouncerProvider,
  LiveRegion,
  useAnnouncer,
  type Announce,
} from './primitives/LiveRegion.tsx';
export { VisuallyHidden } from './primitives/VisuallyHidden.tsx';

export {
  ThemeProvider,
  useOptionalTheme,
  useTheme,
  type ThemeValue,
} from './theme/ThemeProvider.tsx';
export { ThemeSelect, ThemeToggle } from './theme/ThemeToggle.tsx';
export {
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  applyTheme,
  parsePreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  withThemeTransition,
  type ResolvedTheme,
  type ThemePreference,
} from './theme/theme.ts';
export { ACCENTS, PRODUCT_ACCENT, accentClass, type AccentId } from './product-accent.ts';

// Interaction hooks: card tilt, mouse drag and swipe, in-view activation, the call-preview clock.
export * from './interaction/index.ts';
