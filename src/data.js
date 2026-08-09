export const SHOW_META = {
  title: 'Orbital Assembly',
  room: 'Main Stage',
  mode: 'Rehearsal fixture',
};

function cue(number, timecode, department, label, instruction, notes = '') {
  return {
    id: `cue-${String(number).padStart(3, '0')}`,
    number,
    timecode,
    department,
    label,
    instruction,
    notes,
    runState: number < 12 ? 'complete' : number === 12 ? 'current' : 'upcoming',
  };
}

export const CUES = [
  cue(1, '00:00', 'stage', 'House open', 'Release doors and confirm front-of-house ready.', 'Initial audience ingress state.'),
  cue(2, '00:02', 'audio', 'Walk-in bed', 'Bring walk-in music to rehearsal level.', 'Keep host microphones muted.'),
  cue(3, '00:04', 'lighting', 'Room preset', 'Set audience and stage preset to the opening look.'),
  cue(4, '00:05', 'video', 'Lobby loop clear', 'Confirm house screens are on the holding frame.'),
  cue(5, '00:08', 'stage', 'Speaker standby A', 'Place first speaker at stage-left standby.'),
  cue(6, '00:09', 'audio', 'Lectern mic check', 'Confirm lectern path and spare handheld are ready.'),
  cue(7, '00:10', 'lighting', 'House to half', 'Take audience level to half over four seconds.'),
  cue(8, '00:11', 'video', 'Opening ident ready', 'Stand by opening ident and downstream confidence feed.'),
  cue(9, '00:12', 'stage', 'Doors closed', 'Confirm late-entry path and clear stage access.'),
  cue(10, '00:13', 'audio', 'Walk-in bed fade', 'Fade walk-in bed to zero on show call.'),
  cue(11, '00:14', 'lighting', 'House out standby', 'Stand by house out and stage opening look.'),
  cue(12, '00:15', 'stage', 'Host walk-on', 'Call host from stage left and confirm clear deck.', 'Current rehearsal cue.'),
  cue(13, '00:15', 'audio', 'Host mic live', 'Open host microphone when host reaches mark.'),
  cue(14, '00:15', 'lighting', 'Opening look', 'Take house out and bring opening stage look to full.'),
  cue(15, '00:16', 'video', 'Opening ident play', 'Roll ident and take programme output on first frame.'),
  cue(16, '00:17', 'audio', 'Ident sting', 'Play short ident sting under final logo resolve.'),
  cue(17, '00:18', 'stage', 'Speaker A go', 'Send first speaker on host introduction.'),
  cue(18, '00:18', 'lighting', 'Speaker special', 'Take speaker special and reduce host key.'),
  cue(19, '00:19', 'video', 'Speaker lower third', 'Take speaker name key after first sentence.'),
  cue(20, '00:22', 'audio', 'Audience mic standby', 'Stand by aisle microphone for first question.'),
  cue(21, '00:24', 'stage', 'Q&A runner ready', 'Confirm runner is positioned at audience crossover.'),
  cue(22, '00:27', 'video', 'Question slide', 'Take question prompt graphic when host hands to audience.'),
  cue(23, '00:30', 'lighting', 'Audience lift', 'Raise audience level for Q&A without losing speaker key.'),
  cue(24, '00:32', 'audio', 'Audience mic live', 'Open selected audience microphone after runner handoff.'),
  cue(25, '00:38', 'stage', 'Q&A wrap standby', 'Stand by speaker exit and next guest entrance.'),
  cue(26, '00:39', 'video', 'Next segment hold', 'Hold next segment slate until stage confirms clear.'),
  cue(27, '00:40', 'audio', 'Transition bed', 'Bring transition bed under host wrap.'),
  cue(28, '00:41', 'lighting', 'Transition wash', 'Move to transition wash as speaker clears.'),
  cue(29, '00:42', 'stage', 'Speaker A clear', 'Confirm speaker off and reset centre mark.'),
  cue(30, '00:43', 'video', 'Segment slate go', 'Take next segment slate on host cue.'),
  cue(31, '00:44', 'stage', 'Panel standby', 'Place panel guests at stage-right standby positions.'),
  cue(32, '00:45', 'audio', 'Panel mics ready', 'Confirm four panel channels and host return are ready.'),
];
