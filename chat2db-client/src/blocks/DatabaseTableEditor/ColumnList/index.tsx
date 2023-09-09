import React, { memo, useContext, useEffect, useState } from 'react';
import styles from './index.less';
import classnames from 'classnames';
import { MenuOutlined } from '@ant-design/icons';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Table, InputNumber, Input, Form, Select, Checkbox, Button } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import sqlService from '@/service/sql';
import { Context } from '../index'

interface Item {
  key: string;
  columnName: string;
  length: number | null;
  fieldType: string | null;
  nullable: boolean;
}

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

const Row = ({ children, ...props }: RowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props['data-row-key'],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
  };

  return (
    <tr {...props} ref={setNodeRef} style={style} {...attributes}>
      {React.Children.map(children, (child) => {
        if ((child as React.ReactElement).key === 'sort') {
          return React.cloneElement(child as React.ReactElement, {
            children: (
              <MenuOutlined
                ref={setActivatorNodeRef}
                style={{ touchAction: 'none', cursor: 'move' }}
                {...listeners}
              />
            ),
          });
        }
        return child;
      })}
    </tr>
  );
};

const ColumnList = memo(() => {
  const { dataSourceId, databaseName, tableDetails } = useContext(Context);
  const [dataSource, setDataSource] = useState<Item[]>([]);
  const [form] = Form.useForm();
  const [editingKey, setEditingKey] = useState('');
  const [databaseFieldTypeList, setDatabaseFieldTypeList] = useState<string[]>([])

  const isEditing = (record: Item) => record.key === editingKey;

  const edit = (record: Partial<Item> & { key: React.Key }) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.key);
  };

  useEffect(() => {
    if (tableDetails) {
      const list = tableDetails?.columnList?.map(t => {
        return {
          key: uuidv4(),
          columnName: t.name,
          length: t.dataType,
          fieldType: t.columnType,
          nullable: t.nullable === 0,
          comment: t.comment,
        }
      }) || []
      setDataSource(list)
    }
  }, [tableDetails])

  useEffect(() => {
    sqlService.getDatabaseFieldTypeList({
      dataSourceId,
      databaseName,
    }).then(res => {
      setDatabaseFieldTypeList(res.map(i => i.typeName))
    })
  }, [])

  const columns = [
    {
      key: 'sort',
      width: '40px',
      align: 'center'
    },
    {
      title: 'columnName',
      dataIndex: 'columnName',
      render: (text: string, record: Item) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="columnName"
            style={{ margin: 0 }}
          >
            <Input />
          </Form.Item>
        ) : (
          <div
            className={styles.editableCell}
            onClick={() => edit(record)}
          >
            {text}
          </div>
        );
      }
    },
    {
      title: 'length',
      dataIndex: 'length',
      editable: true,
      render: (text: string, record: Item) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="length"
            style={{ margin: 0 }}
          >
            <InputNumber />
          </Form.Item>
        ) : (
          <div
            className={styles.editableCell}
            onClick={() => edit(record)}
          >
            {text}
          </div>
        );
      }
    },
    {
      title: 'fieldType',
      dataIndex: 'fieldType',
      render: (text: string, record: Item) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="fieldType"
            style={{ margin: 0 }}
          >
            <Select
              style={{ width: 120 }}
              options={databaseFieldTypeList.map((i) => ({ label: i, value: i }))}
            />
          </Form.Item>
        ) : (
          <div
            className={styles.editableCell}
            onClick={() => edit(record)}
          >
            {text}
          </div>
        );
      }
    },
    {
      title: 'nullable',
      dataIndex: 'nullable',
      width: '100px',
      render: (text: boolean, record: Item) => {
        return <Form.Item
          name="nullable"
          style={{ margin: 0 }}
        >
          <Checkbox checked={text} />
        </Form.Item>
      }
    },
    {
      title: 'comment',
      dataIndex: 'comment',
      render: (text: string, record: Item) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="comment"
            style={{ margin: 0 }}
          >
            <Input />
          </Form.Item>
        ) : (
          <div
            className={styles.editableCell}
            onClick={() => edit(record)}
          >
            {text}
          </div>
        );
      }
    },
  ];

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id) {
      setDataSource((previous) => {
        const activeIndex = previous.findIndex((i) => i.key === active.id);
        const overIndex = previous.findIndex((i) => i.key === over?.id);
        return arrayMove(previous, activeIndex, overIndex);
      });
    }
  };

  const formChange = (value: any) => {
    const newData = form.getFieldsValue();
    setDataSource(dataSource.map(i => {
      if (i.key === editingKey) {
        return {
          ...i,
          ...newData
        }
      }
      return i
    }))
  }

  const addData = () => {
    const newData = {
      key: uuidv4(),
      columnName: '',
      length: null,
      fieldType: null,
      nullable: false,
    }
    setDataSource([...dataSource, newData])
    edit(newData)
  }

  const deleteData = () => {
    setDataSource(dataSource.filter(i => i.key !== editingKey))
  }

  const moveData = (action: 'up' | 'down') => {
    const index = dataSource.findIndex(i => i.key === editingKey)
    if (index === -1) {
      return
    }
    if (action === 'up') {
      if (index === 0) {
        return
      }
      const newData = [...dataSource]
      newData[index] = dataSource[index - 1]
      newData[index - 1] = dataSource[index]
      setDataSource(newData)
    } else {
      if (index === dataSource.length - 1) {
        return
      }
      const newData = [...dataSource]
      newData[index] = dataSource[index + 1]
      newData[index + 1] = dataSource[index]
      setDataSource(newData)
    }
  }

  return (
    <div className={styles.box}>
      <div className={styles.columnListHeader}>
        <Button onClick={addData}>新增</Button>
        <Button onClick={deleteData}>删除</Button>
        <Button onClick={moveData.bind(null, 'up')}>上移</Button>
        <Button onClick={moveData.bind(null, 'down')}>下移</Button>
      </div>
      <div className={styles.tableBox}>
        <Form form={form} onChange={formChange}>
          <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
            <SortableContext
              items={dataSource.map((i) => i.key)}
              strategy={verticalListSortingStrategy}
            >
              <Table
                components={{
                  body: {
                    row: Row,
                  },
                }}
                pagination={false}
                rowKey="key"
                columns={columns as any}
                dataSource={dataSource}
              />
            </SortableContext>
          </DndContext>
        </Form>
      </div>
    </div>
  );
})


export default ColumnList;