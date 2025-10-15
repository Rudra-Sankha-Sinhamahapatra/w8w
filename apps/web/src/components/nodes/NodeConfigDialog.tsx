import { Dialog, DialogClose, DialogContent, DialogTitle } from "@radix-ui/react-dialog";
import { useState, useMemo } from "react";
import { useThemeStore } from "../../store/useThemeStore";
import type { Edge, Node } from '@xyflow/react';
import type { FlowNodeData, Workflow, WorkflowCredential } from '../../types/workflow';
import FormNodeConfig from "./FormNodeConfig";
import { getAncestorNodes } from "../../utils/getAnscestorNodes";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";

interface VariableOption {
  label: string;
  value: string;
  tooltip?: string;
}

type NodeConfigDialogProps = {
  node: Node<FlowNodeData>;
  credentials: WorkflowCredential[];
  workflow: Workflow | null;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onClose: () => void;
  onSave: (data: FlowNodeData) => void;
};


export default function NodeConfigDialog({ node, credentials, onClose, onSave, workflow, nodes, edges }: NodeConfigDialogProps) {
  const [credentialId, setCredentialId] = useState<string>(node.data.credentialsId || "");
  const [copied, setCopied] = useState<boolean>(false);

  const [config, setConfig] = useState<Record<string, any>>(() => {
    const defaultConfig: Record<string, string> = {};

    switch (node.type) {
      case 'ResendEmail':
        defaultConfig.to = node.data.config?.to || '';
        defaultConfig.subject = node.data.config?.subject || '';
        defaultConfig.body = node.data.config?.body || '';
        break;
      case 'Telegram':
        defaultConfig.message = node.data.config?.message || '';
        break;
      case 'Gemini':
        defaultConfig.prompt = node.data.config?.prompt || '';
        defaultConfig.memory = node.data.config?.memory ?? false;
        break;
      case 'Slack':
        defaultConfig.channel = node.data.config?.channel || '';
        defaultConfig.message = node.data.config?.message || '';
        break;
      case 'Form':
        defaultConfig.title = node.data.config?.title || '',
          defaultConfig.fields = node.data.config?.fields || []
        break;
    }

    return defaultConfig;
  });

  const { theme } = useThemeStore();
  const isDark = theme === 'dark';


  const availableVariables = useMemo(() => {
    const variables: VariableOption[] = [];

    if (workflow?.triggerType === 'Webhook') {
      variables.push({
        label: 'Webhook Body Data',
        value: '{{ $json.body }}',
        tooltip: 'Access any data from the webhook body'
      });
    }

    const ancestorNodes = getAncestorNodes(node.id, edges, nodes);

    ancestorNodes.forEach(sourceNode => {
      if (!sourceNode) return;

      let outputFields: string[] = [];
      switch (sourceNode.type) {
        case 'Gemini':
          outputFields = ['.text', '.query'];
          break;
        case 'ResendEmail':
          outputFields = ['.to', '.subject', '.body'];
          break;
        case 'Telegram':
          outputFields = ['.message'];
          break;
        case 'Slack':
          outputFields = ['.channel', '.text'];
          break;
        case 'Form':
          const fields = sourceNode.data?.config?.fields || [];
          fields.forEach((field: any) => {
            variables.push({
              label: `${sourceNode.id} (Form) - ${field.key}`,
              value: `{{ $json.body.${field.key} }}`,
              tooltip: `Form field: ${field.key}\nPosition in Flow: ${sourceNode.id}`
            });
          });
          break;
      }

      if (sourceNode.type !== 'Form') {
        outputFields.forEach(field => {
          variables.push({
            label: `${sourceNode.id} (${sourceNode.data?.label || sourceNode.type})${field}`,
            value: `{{ $node.${sourceNode.id}${field} }}`,
            tooltip: `Node Type: ${sourceNode.type}\nPosition in Flow: ${sourceNode.id}`
          });
        })
      }
    });

    return variables;
  }, [nodes, edges, workflow, node.id]);

  const getFieldInfo = (key: string) => {
    switch (node.type) {
      case 'ResendEmail':
        switch (key) {
          case 'to':
            return {
              label: 'To Email',
              placeholder: 'recipient@example.com or use variables',
              type: 'text',
              helper: 'Email address or variable from webhook/connected nodes'
            };
          case 'subject':
            return {
              label: 'Subject',
              placeholder: 'Email subject with optional variables',
              type: 'text',
              helper: 'Can include variables for dynamic content'
            };
          case 'body':
            return {
              label: 'Body',
              placeholder: 'Email body with optional variables',
              type: 'textarea',
              helper: 'Supports variables from webhook or connected nodes'
            };
        }
        break;
      case 'Telegram':
        return {
          label: 'Message',
          placeholder: 'Message text with optional variables',
          type: 'textarea',
          helper: 'Can include variables for dynamic content'
        };
      case 'Gemini':
        return {
          label: 'Prompt',
          placeholder: 'Prompt text with optional variables',
          type: 'textarea',
          helper: 'Can include variables from webhook or connected nodes'
        };
      case 'Slack':
        switch (key) {
          case "channel":
            return {
              label: "Slack Cannel Id",
              placeholder: "Enter your slack channel Id",
              type: "text",
              helper: "You can get slack channel id from slack api. Also give bot channel permission"
            };
          case "message":
            return {
              label: "Slack Message",
              placeholder: "Enter your slack message",
              type: "text",
              helper: "Enter the message you want your bot to send"
            }
        }
        break;

      case 'Form':
        switch (key) {
          case 'title':
            return {
              label: "Form Title",
              placeholder: "Enter form title",
              type: "text",
              helper: "This will be shown at the top of the form"
            };
          case "fields":
            return {
              label: "fields",
              placeholder: "Add Fields (JSON array)",
              type: "textarea",
              helper: 'Example: [{"label": "Name", "type": "text"}, {"label": "Email", "type": "email"}]'
            }
        }
        break;
    }
    return {
      label: key,
      placeholder: `Enter ${key}`,
      type: 'text',
      helper: ''
    };
  };


  const formEntry = workflow?.form?.find((f) => f.nodeId === node.id) || null;

  // console.log("Dialog node.id:", node.id, "workflow form:", workflow?.form);


  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={`${isDark ? "bg-zinc-900" : "bg-white"} p-6 rounded-lg max-h-[80vh] overflow-y-auto`}>
        <DialogTitle className="font-bold mb-4">
          Configure {node.type}
        </DialogTitle>

        <div className="space-y-4">
          {node.type !== "Form" && (
            <div>
              <label className="block mb-2">Credential</label>
              <select
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                className={`w-full border rounded p-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200'
                  }`}
              >
                <option value="">Select Credential</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          )}


          {Object.entries(config).map(([key, value]) => {
            if (node.type === 'Gemini' && key === 'memory') {
              return null;
            }

            const fieldInfo = getFieldInfo(key);

            if (node.type === "Form" && key === "fields") {
              return (
                <FormNodeConfig
                  key={key}
                  initialFields={config.fields || []}
                  onSave={(fields) => setConfig({ ...config, fields })}
                  formEntry={formEntry}
                />
              );
            }

            return (
              <div key={key}>
                <label className="block mb-2 font-medium">{fieldInfo.label}</label>
                <div className="space-y-2">
                  {fieldInfo.type === 'textarea' ? (
                    <textarea
                      value={value}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      className={`w-full border rounded p-2 min-h-[280px] ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200'
                        }`}
                      placeholder={fieldInfo.placeholder}
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      className={`w-full border rounded p-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200'
                        }`}
                      placeholder={fieldInfo.placeholder}
                    />
                  )}
                  {fieldInfo.helper && (
                    <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {fieldInfo.helper}
                    </p>
                  )}
                  {availableVariables.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const newValue = value ? `${value} ${e.target.value}` : e.target.value;
                        setConfig({ ...config, [key]: newValue });
                        e.target.value = '';
                      }}
                      className={`w-full border rounded p-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200'
                        }`}
                    >
                      <option value="">Insert variable...</option>
                      {availableVariables.map((v) => (
                        <option key={v.value} value={v.value} title={v.tooltip || v.label}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })}


          {node.type === 'Gemini' && (
            <>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.memory === true}
                    onChange={(e) => setConfig({ ...config, memory: e.target.checked })}
                  />
                  Enable Memory
                </label>
                <p className="text-sm text-zinc-500">
                  If enabled, Gemini will recall the latest 25 conversations for this workflow.
                </p>
              </div>

              {(node.data as any)?.output && (
                <div
                  className={`relative mt-4 text-sm p-3 max-w-[500px] rounded border ${isDark
                      ? "bg-zinc-800 border-zinc-700 text-zinc-200"
                      : "bg-zinc-100 border-zinc-300 text-zinc-900"
                    }`}
                >
                  <strong className="block mb-2">Latest Output</strong>


                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText((node.data as any).output);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch (err) {
                        console.error("Failed to copy:", err);
                      }
                    }}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-zinc-700/30 transition"
                    title="Copy output"
                  >
                    {copied ? (
                      <CheckIcon
                        className={`w-4 h-4 ${isDark ? "text-green-400" : "text-green-600"
                          } transition-all`}
                      />
                    ) : (
                      <CopyIcon
                        className={`w-4 h-4 ${isDark ? "text-zinc-400" : "text-zinc-600"
                          } hover:text-blue-500 transition-all`}
                      />
                    )}
                  </button>

                  {/* Output text */}
                  <pre className="whitespace-pre-wrap break-words text-xs max-h-[200px] overflow-y-auto pr-6">
                    {(node.data as any).output}
                  </pre>
                </div>
              )}

            </>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <DialogClose asChild>
              <button className={`px-4 py-2 rounded ${isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                }`}>
                Cancel
              </button>
            </DialogClose>

            <button
              onClick={() => onSave({ ...node.data, credentialsId: credentialId, config })}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}