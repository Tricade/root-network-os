/** Physical terminals carry their room into every room-scoped workspace. */
export function selectWorkspaceRoom(ctx, roomId) {
  if (!roomId || !ctx.R.selectRoom(roomId)) return false;
  ctx.selectCustomerRoom(roomId);
  ctx.selectRoomOperations(roomId);
  return true;
}
