// The persistent layer behind every page: the field of light the app lives in. This is the still
// version (the mineral gradient from the tokens), which is also what stays when effects are off.
// The animated field is built on top of it in this folder.
export function WorldLayer() {
  return <div className="world" data-vt-persist="world" aria-hidden="true" />;
}
