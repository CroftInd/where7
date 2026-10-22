/** Presentation-only helpers. No scoring, privacy, or gameplay rules live here. */
export function shouldAnimate(reduceMotion:boolean):boolean{return !reduceMotion}
export function formatScore(score:number):string{return Math.max(0,Math.round(score)).toLocaleString('en-GB')}
/** Shift the target into the exposed map area (beside the desktop clue sheet). */
export function mapCameraOffset(width:number,pickMode:boolean):[number,number]{
  if(pickMode)return [0,0];
  return width>700?[205,0]:width<=700?[0,-48]:[0,0];
}
