import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useThemeStore } from '../../store/useThemeStore';
import type { FlowNodeData } from '../../types/workflow';
import { nodeIcons } from '../../lib/nodeIcons';
import type { NodeStatus } from '../../types/node';

type CustomNodeProps = {
  data: FlowNodeData & {
    status?: NodeStatus,
    output?: string,
  };
  selected?: boolean;
};

const BaseNode = ({ data }: CustomNodeProps) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  if (!data) return null;

  const tooltipContent = `Node ID: ${data.id}
Type: ${data.type}
Use in config as: {{ $node.${data.id} }}
${data.type === 'Gemini' ? '\nOutput: {{ $node.' + data.id + '.text }}' : ''}`;

  let execDotColor = 'bg-zinc-400';
  let execDotLabel = 'Idle (not running)';
  if (data.status === 'running') {
    execDotColor = 'bg-yellow-500';
    execDotLabel = 'Running';
  }
  if (data.status === 'success') {
    execDotColor = 'bg-green-500';
    execDotLabel = 'Succeeded';
  }
  if (data.status === 'failed') {
    execDotColor = 'bg-red-500';
    execDotLabel = 'Failed';
  }

  let credsReady = !!data.credentialsId;
  let credsDotColor = credsReady ? 'bg-green-500' : 'bg-yellow-500';
  let credsDotLabel = credsReady ? 'Credentials ready' : 'Missing credentials';

  if (data.type === 'Form') {
    const fields = data.config?.fields || [];

    const invalid = fields.some(
      (f: any) =>
        !f.label ||
        ((f.type === "select" || f.type === "radio") && (!f.options || f.options.length === 0))
    );

    credsReady = !invalid;
    credsDotColor = invalid ? 'bg-yellow-500' : 'bg-green-500';
    credsDotLabel = invalid ? 'Incomplete form config' : 'Ready';
  } else {
    credsReady = !!data.credentialsId;
    credsDotColor = credsReady ? 'bg-green-500' : 'bg-yellow-500';
    credsDotLabel = credsReady ? 'Credentials ready' : 'Missing credentials';
  }

  return (
    <div
      className={`px-4 py-2 shadow-md rounded-md border group relative ${isDark ? 'border-zinc-700' : 'border-zinc-200'
        } ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900'
        }`}
      title={tooltipContent}
    >

      <div className={`absolute bottom-full left-0 mb-2 p-2 rounded text-sm whitespace-pre
        opacity-0 group-hover:opacity-100 transition-opacity
        ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-900'}
        border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}
        shadow-lg z-50
      `}>
        {tooltipContent}
      </div>

      <div className="flex items-center justify-center relative">
        <div className={`absolute top-5 -right-3 w-2 h-2 rounded-full ${execDotColor}`}
          title={`Execution status: ${execDotLabel}`}
        >

          <div className={`w-2 h-2 rounded-full ${execDotColor}`} />
        </div>

        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${credsDotColor}`}
          title={`Credentials: ${credsDotLabel}`}
        />
        <div className="relative">
          <img
            src={nodeIcons[data.type]}
            alt={data.label}
            className="w-8 h-8"
          />
          <div className={`absolute -bottom-1 -right-1 text-[10px] px-1 rounded-sm
            ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'}
          `}>
            {String(data.id)}
          </div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className={`w-2 h-2 ${isDark ? '!bg-zinc-600' : '!bg-zinc-300'
          }`}
      />

      <Handle
        type="source"
        position={Position.Right}
        className={`w-2 h-2 ${isDark ? '!bg-zinc-600' : '!bg-zinc-300'
          }`}
      />
    </div>
  );
};

export default memo(BaseNode);