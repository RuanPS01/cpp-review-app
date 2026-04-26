#include <iostream>
#include <iomanip> //Para fixar o número de casas decimais(média e casas depois da vírgula)

using namespace std;

int main(){
    
    //Definindo as variáveis
    int temp; // Tempo de cada aluno
    double qnt; // Quantidade de alunos que digitou o tempo
    double soma = 0; // Soma dos tempos
    int maior = -10000; // Variável maior para a comparação
    double media = 0; // Variável para fazer o cálculo de média
    
    //Entrada de dados
    cin >> temp;
    
    //Estrutura de repetição while
    while(temp != 0){
        
        //Entrada de dados nas variáveis
        soma += temp;
        qnt++;
        
        //Estrutura if
        if(temp > maior){
            
            maior = temp;
        }
        
        //Nova entrada
        cin >> temp;
        
    }
    
    //Estrutura de decisão para caso dê indeterminação matemática - 0/0
    if(qnt == 0){
        
        cout << fixed << setprecision(2) << "0.00" << endl;
        return 0;
    }
    
    else{
        
        media = soma/qnt;
    }
    
    //Saída de dados
    cout << fixed << setprecision(2);
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << "Media dos tempos: " << media << " minutos" << endl;
    
    return 0;
}