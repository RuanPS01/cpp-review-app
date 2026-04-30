#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    
    //Declaração de variáveis
    
    int estrela[100], a, cont = 0;
    double cont1 = 0, cont2 = 0, cont3 = 0, cont4 = 0, cont5 = 0; //Contadores de estrelas
    double porc1 = 0, porc2 = 0, porc3 = 0, porc4 = 0, porc5 = 0; //Porcentagem de estrelas
    
    //Entradas
    
    while(a != 6){
        cin >> estrela[cont];
        a = estrela[cont];
        
        if(estrela[cont] == 1)
        cont1++;
        if(estrela[cont] == 2)
        cont2++;
        if(estrela[cont] == 3)
        cont3++;
        if(estrela[cont] == 4)
        cont4++;
        if(estrela[cont] == 5)
        cont5++;
        
        if(estrela[cont] != 6)
        cont++;
    }
    
    //Processo
    
    porc1 = (cont1*100)/cont;
    porc2 = (cont2*100)/cont;
    porc3 = (cont3*100)/cont;
    porc4 = (cont4*100)/cont;
    porc5 = (cont5*100)/cont;
    
    //Saídas
    
    cout << fixed << setprecision(2);
    cout << "1 estrela: " << porc1 << "%" << endl;
    cout << "2 estrelas: " << porc2 << "%" << endl; 
    cout << "3 estrelas: " << porc3 << "%" << endl; 
    cout << "4 estrelas: " << porc4 << "%" << endl;
    cout << "5 estrelas: " << porc5 << "%" << endl;
    
    return 0;
}