import OpenAI from 'openai'

export function useOpenAI() {
  return new OpenAI({
    baseURL: 'http://host.docker.internal:8080/v1', // This is the default and can be omitted
    apiKey: '',
    dangerouslyAllowBrowser: true,
  })
}
