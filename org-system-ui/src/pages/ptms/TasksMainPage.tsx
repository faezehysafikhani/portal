import { Tabs } from 'antd'
import { CheckSquareOutlined, AppstoreOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons'
import AllTasksPage from './AllTasksPage'
import KanbanPage from './KanbanPage'
import TaskCalendarPage from './TaskCalendarPage'
import OverdueTasksPage from './OverdueTasksPage'

export default function TasksMainPage() {
  return (
    <Tabs
      defaultActiveKey="1"
      type="card"
      size="large"
      style={{ direction: 'rtl' }}
      items={[
        {
          key: '1',
          label: <span><CheckSquareOutlined /> همه وظایف</span>,
          children: <AllTasksPage />
        },
        {
          key: '2',
          label: <span><AppstoreOutlined /> تخته کانبان</span>,
          children: <KanbanPage />
        },
        {
          key: '3',
          label: <span><CalendarOutlined /> تقویم وظایف</span>,
          children: <TaskCalendarPage />
        },
        {
          key: '4',
          label: <span><ClockCircleOutlined /> وظایف معوقه</span>,
          children: <OverdueTasksPage />
        },
      ]}
    />
  )
}