import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Tree,
  Tag,
  Popconfirm,
  message
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined
} from '@ant-design/icons';

interface Role {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

interface PermissionNode {
  title: string;
  key: string;
  children?: PermissionNode[];
}

const RolesManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  const permissions: PermissionNode[] = [
    {
      title: 'Dashboard',
      key: 'dashboard',
      children: [
        { title: 'View', key: 'dashboard:view' },
        { title: 'Export', key: 'dashboard:export' },
      ],
    },
    {
      title: 'Users',
      key: 'users',
      children: [
        { title: 'View', key: 'users:view' },
        { title: 'Create', key: 'users:create' },
        { title: 'Edit', key: 'users:edit' },
        { title: 'Delete', key: 'users:delete' },
      ],
    },
    {
      title: 'Roles',
      key: 'roles',
      children: [
        { title: 'View', key: 'roles:view' },
        { title: 'Create', key: 'roles:create' },
        { title: 'Edit', key: 'roles:edit' },
        { title: 'Delete', key: 'roles:delete' },
      ],
    },
  ];

  const columns = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <LockOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) => (
        <Space size={[0, 8]} wrap>
          {permissions.map(permission => (
            <Tag key={permission} color="blue">
              {permission}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Role) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this role?"
            onConfirm={() => handleDelete(record.key)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const data: Role[] = [
    {
      key: '1',
      name: 'Administrator',
      description: 'Full system access',
      permissions: ['dashboard:view', 'dashboard:export', 'users:view', 'users:create', 'users:edit', 'users:delete', 'roles:view', 'roles:create', 'roles:edit', 'roles:delete'],
    },
    {
      key: '2',
      name: 'User',
      description: 'Basic system access',
      permissions: ['dashboard:view', 'users:view'],
    },
  ];

  const handleAdd = () => {
    setEditingRole(null);
    form.resetFields();
    setCheckedKeys([]);
    setIsModalVisible(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue(role);
    setCheckedKeys(role.permissions);
    setIsModalVisible(true);
  };

  const handleDelete = (key: string) => {
    message.success('Role deleted successfully');
  };

  const handleModalOk = () => {
    form.validateFields().then((values: Role) => {
      const updatedRole = {
        ...values,
        permissions: checkedKeys,
      };
      
      if (editingRole) {
        message.success('Role updated successfully');
      } else {
        message.success('Role created successfully');
      }
      setIsModalVisible(false);
    });
  };

  const onCheck = (checked: string[]) => {
    setCheckedKeys(checked);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          Add Role
        </Button>
      </div>

      <Table columns={columns} dataSource={data} />

      <Modal
        title={editingRole ? 'Edit Role' : 'Add Role'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="Role Name"
            rules={[{ required: true, message: 'Please input role name!' }]}
          >
            <Input prefix={<LockOutlined />} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please input description!' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item
            label="Permissions"
            required
          >
            <Tree
              checkable
              checkedKeys={checkedKeys}
              onCheck={(checked) => onCheck(checked as string[])}
              treeData={permissions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RolesManagement; 