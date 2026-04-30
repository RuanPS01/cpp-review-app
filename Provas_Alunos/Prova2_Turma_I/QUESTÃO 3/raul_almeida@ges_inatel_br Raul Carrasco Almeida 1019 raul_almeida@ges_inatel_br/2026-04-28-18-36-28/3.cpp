#include <iostream>
#include <iomanip>

using namespace std;
int main()
{
    // o programa ficou em evaluating achei q eu estaria no caminho certo se ele carregasse da uma olha professor
    int N;
    int quantidade = 0;
    int quantidades = 0;
    int quantidadess = 0;
    int quantidadesss  = 0;
    int quantidadessss = 0;
    cin >> N;
    
    while(N != 6){
        if(N == 1){
            quantidade++;
        }
        else if(N == 2){
            quantidades++;
        }
        else if(N == 3){
            quantidadess++;
        }
        else if(N == 4){
            quantidadesss++;
        }
        else if(N == 5){
            quantidadessss++;
        }
    }
    cout << fixed << setprecision(2);
    cout << "1 estrela: %" << quantidade << endl;
    cout << "2 estrelas: %" << quantidades << endl;
    cout << "3 estrrela: %" << quantidadess << endl;
    cout << "4 estrelas: %" << quantidadesss << endl;
    cout << "5 estrelas: %" << quantidadessss << endl;
    
    
    
    
    
    
    
    
    return 0;
}