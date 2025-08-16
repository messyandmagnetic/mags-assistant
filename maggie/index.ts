import { watchRawFolder } from './tasks/watch-raw'
import { scheduleNextPost } from './tasks/scheduler'
import { checkForFlops } from './tasks/retry-flops'

watchRawFolder()
scheduleNextPost()
checkForFlops()
