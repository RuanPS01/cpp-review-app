#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    
    //Declaração de variáveis
    
    int quant;
    double alt, maior = 0, menor = 0;
    
    //Entradas
    
    cin >> quant; //Pede a quantidade de alturas que o codigo vai comparar
    
    cin >> maior; //Pede o primeiro valor de altura e o coloca como referência de maior
    menor = maior; //Coloca o primeiro valor de altura como referência de menor também
    
    //Repetição para separação
    
    for(int i = 1; i < quant; i++){ //A repetição ja começa em 1 porque o primeiro dado já foi pedido
        cin >> alt;
        if(alt > maior){
            maior = alt;
        }
        if(alt < menor){
            menor = alt;
        }
    }
    
    //Saídas com apenas 2 casas depois da vírgula
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << "Maior altura: " << maior << endl;
    
    return 0;
}